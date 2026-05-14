/**
 * Postgres-backed conversation store. Keyed by (channel, handle).
 * Persists the last 20 messages per conversation.
 */
import postgres from "postgres";
import { v4 as uuid } from "uuid";

export type StoredMessage = {
  role: "user" | "assistant" | "tool";
  content: string;
  tool_calls?: unknown[];
  tool_call_id?: string;
  name?: string;
  ts: string;
};

const MAX_MESSAGES = 20;

export class ConversationStore {
  constructor(private sql: ReturnType<typeof postgres>) {}

  async load(channel: string, handle: string): Promise<StoredMessage[]> {
    const rows = await this.sql<Array<{ messages: StoredMessage[] }>>`
      SELECT messages FROM agent_conversations
       WHERE channel = ${channel} AND handle = ${handle}
       LIMIT 1
    `;
    return rows[0]?.messages ?? [];
  }

  async append(channel: string, handle: string, msgs: StoredMessage[]): Promise<void> {
    const prior = await this.load(channel, handle);
    const next = [...prior, ...msgs].slice(-MAX_MESSAGES);
    await this.sql`
      INSERT INTO agent_conversations (id, channel, handle, messages, last_active)
      VALUES (${uuid()}, ${channel}, ${handle}, ${JSON.stringify(next)}::jsonb, now())
      ON CONFLICT (channel, handle) DO UPDATE
         SET messages = EXCLUDED.messages, last_active = now()
    `;
  }
}
