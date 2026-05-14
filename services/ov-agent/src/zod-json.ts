/**
 * Minimal Zod → JSON Schema converter sufficient for the tools the agent
 * exposes. Covers object, array, string, number, boolean, optional, enum, uuid,
 * and recursive nested objects. We avoid the heavyweight zod-to-json-schema dep
 * to keep cold-starts fast.
 */
import { z, type ZodTypeAny } from "zod";

export function zodToJsonSchema(schema: ZodTypeAny): Record<string, unknown> {
  if (schema instanceof z.ZodObject) {
    const shape = schema._def.shape();
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const [k, v] of Object.entries(shape)) {
      const child = v as ZodTypeAny;
      const isOpt = child.isOptional?.() || child._def?.typeName === "ZodOptional" || child._def?.typeName === "ZodDefault";
      properties[k] = zodToJsonSchema(unwrap(child));
      if (!isOpt) required.push(k);
    }
    const out: Record<string, unknown> = {
      type: "object",
      properties,
      additionalProperties: false,
    };
    if (required.length > 0) out.required = required;
    return out;
  }
  if (schema instanceof z.ZodArray) {
    return { type: "array", items: zodToJsonSchema(schema._def.type) };
  }
  if (schema instanceof z.ZodEnum) {
    return { type: "string", enum: [...schema._def.values] };
  }
  if (schema instanceof z.ZodString) {
    const out: Record<string, unknown> = { type: "string" };
    for (const ch of schema._def.checks ?? []) {
      if (ch.kind === "uuid") out.format = "uuid";
      else if (ch.kind === "datetime") out.format = "date-time";
    }
    return out;
  }
  if (schema instanceof z.ZodNumber) return { type: "number" };
  if (schema instanceof z.ZodBoolean) return { type: "boolean" };
  if (schema instanceof z.ZodLiteral) return { const: schema._def.value };
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodDefault) {
    return zodToJsonSchema(schema._def.innerType);
  }
  if (schema instanceof z.ZodUnion) {
    return { anyOf: schema._def.options.map((o: ZodTypeAny) => zodToJsonSchema(o)) };
  }
  return {};
}

function unwrap(s: ZodTypeAny): ZodTypeAny {
  if (s instanceof z.ZodOptional || s instanceof z.ZodDefault) return s._def.innerType;
  return s;
}
