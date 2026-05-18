/**
 * Postgres-backed Glove `StoreAdapter`, keyed by (channel, handle).
 *
 * Persists the Glove message history plus token/turn counters in the
 * existing `agent_conversations` table so a WhatsApp / Telegram user keeps
 * conversational context across messages even though each inbound message
 * builds a fresh Glove instance. History is trimmed to the most recent
 * `MAX_MESSAGES`; Glove's own context compaction keeps the model prompt
 * bounded within that.
 */
import postgres from "postgres";
import { v4 as uuid } from "uuid";
import type {
  InboxItem,
  Message,
  StoreAdapter,
  TokenConsumptionCounter,
} from "glove-core";

const MAX_MESSAGES = 40;

export class PgConversationStore implements StoreAdapter {
  identifier: string;
  private loaded = false;
  private messages: Message[] = [];
  private tokensIn = 0;
  private tokensOut = 0;
  private turns = 0;

  constructor(
    private sql: ReturnType<typeof postgres>,
    private channel: string,
    private handle: string,
  ) {
    this.identifier = `${channel}:${handle}`;
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    const rows = await this.sql<
      Array<{ messages: Message[]; tokens_in: string; tokens_out: string; turns: number }>
    >`
      SELECT messages, tokens_in, tokens_out, turns
        FROM agent_conversations
       WHERE channel = ${this.channel} AND handle = ${this.handle}
       LIMIT 1
    `;
    const r = rows[0];
    if (r) {
      // Tolerate legacy rows that were double-encoded (stored as a JSON
      // string instead of a jsonb array) so existing chats keep history.
      let m: unknown = r.messages;
      if (typeof m === "string") {
        try {
          m = JSON.parse(m);
        } catch {
          m = [];
        }
      }
      this.messages = Array.isArray(m) ? (m as Message[]) : [];
      this.tokensIn = Number(r.tokens_in) || 0;
      this.tokensOut = Number(r.tokens_out) || 0;
      this.turns = Number(r.turns) || 0;
    }
    this.loaded = true;
  }

  private async persist(): Promise<void> {
    if (this.messages.length > MAX_MESSAGES) {
      this.messages = this.messages.slice(-MAX_MESSAGES);
    }
    await this.sql`
      INSERT INTO agent_conversations
        (id, channel, handle, messages, tokens_in, tokens_out, turns, last_active)
      VALUES (
        ${uuid()}, ${this.channel}, ${this.handle},
        ${this.sql.json(this.messages as never)},
        ${this.tokensIn}, ${this.tokensOut}, ${this.turns}, now()
      )
      ON CONFLICT (channel, handle) DO UPDATE
         SET messages = EXCLUDED.messages,
             tokens_in = EXCLUDED.tokens_in,
             tokens_out = EXCLUDED.tokens_out,
             turns = EXCLUDED.turns,
             last_active = now()
    `;
  }

  async getMessages(): Promise<Message[]> {
    await this.ensureLoaded();
    return this.messages;
  }

  async appendMessages(msgs: Message[]): Promise<void> {
    await this.ensureLoaded();
    this.messages.push(...msgs);
    await this.persist();
  }

  async getTokenCount(): Promise<number> {
    await this.ensureLoaded();
    return this.tokensIn + this.tokensOut;
  }

  async addTokens(args: TokenConsumptionCounter): Promise<void> {
    await this.ensureLoaded();
    this.tokensIn += args.tokens_in || 0;
    this.tokensOut += args.tokens_out || 0;
    await this.persist();
  }

  async getTurnCount(): Promise<number> {
    await this.ensureLoaded();
    return this.turns;
  }

  async incrementTurn(): Promise<void> {
    await this.ensureLoaded();
    this.turns += 1;
    await this.persist();
  }

  async resetCounters(): Promise<void> {
    await this.ensureLoaded();
    this.tokensIn = 0;
    this.tokensOut = 0;
    this.turns = 0;
    await this.persist();
  }

  /**
   * Wipe this conversation entirely — messages + token/turn counters — so
   * the next message starts a brand-new Glove session. Deletes the row
   * (a fresh one is upserted on the next `persist()`). The agent inbox is
   * intentionally left intact: those are surveillance alerts the operator
   * may still want surfaced, not chat history.
   */
  async clear(): Promise<void> {
    await this.sql`
      DELETE FROM agent_conversations
       WHERE channel = ${this.channel} AND handle = ${this.handle}
    `;
    this.messages = [];
    this.tokensIn = 0;
    this.tokensOut = 0;
    this.turns = 0;
    this.loaded = true;
  }

  // ── Glove inbox (Postgres `agent_inbox`, scoped to this channel+handle) ──
  // Notifications posted while the user was away are written here with
  // status='resolved'; Glove auto-injects them on the next turn and then
  // marks them 'consumed', so the agent surfaces them once on resume.

  private static toInboxItem(r: any): InboxItem {
    return {
      id: r.id,
      tag: r.tag,
      request: r.request,
      response: r.response ?? null,
      status: r.status,
      blocking: r.blocking,
      created_at: new Date(r.created_at).toISOString(),
      resolved_at: r.resolved_at ? new Date(r.resolved_at).toISOString() : null,
    };
  }

  async getInboxItems(): Promise<InboxItem[]> {
    const rows = await this.sql<any[]>`
      SELECT * FROM agent_inbox
       WHERE channel = ${this.channel} AND handle = ${this.handle}
       ORDER BY created_at ASC
    `;
    return rows.map(PgConversationStore.toInboxItem);
  }

  async addInboxItem(item: InboxItem): Promise<void> {
    await this.sql`
      INSERT INTO agent_inbox
        (id, channel, handle, tag, request, response, status, blocking, created_at, resolved_at)
      VALUES (
        ${item.id}, ${this.channel}, ${this.handle}, ${item.tag},
        ${item.request}, ${item.response}, ${item.status}, ${item.blocking},
        ${item.created_at}, ${item.resolved_at}
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }

  async updateInboxItem(
    itemId: string,
    updates: Partial<Pick<InboxItem, "status" | "response" | "resolved_at">>,
  ): Promise<void> {
    await this.sql`
      UPDATE agent_inbox SET
        status = COALESCE(${updates.status ?? null}, status),
        response = COALESCE(${updates.response ?? null}, response),
        resolved_at = COALESCE(${updates.resolved_at ?? null}, resolved_at)
       WHERE id = ${itemId}
         AND channel = ${this.channel} AND handle = ${this.handle}
    `;
  }

  async getResolvedInboxItems(): Promise<InboxItem[]> {
    const rows = await this.sql<any[]>`
      SELECT * FROM agent_inbox
       WHERE channel = ${this.channel} AND handle = ${this.handle}
         AND status = 'resolved'
       ORDER BY created_at ASC
    `;
    return rows.map(PgConversationStore.toInboxItem);
  }
}
