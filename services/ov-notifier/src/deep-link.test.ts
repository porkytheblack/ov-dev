import { describe, expect, it } from "vitest";
import { signDeepLink, verifyDeepLink } from "./deep-link.js";

const secret = "test-secret";
const incidentId = "11111111-1111-1111-1111-111111111111";

describe("deep link", () => {
  it("roundtrips", () => {
    const r = signDeepLink({ incidentId, secret, ttlHours: 1 });
    expect(verifyDeepLink({ incidentId, token: r.token, secret }).ok).toBe(true);
  });
  it("detects mismatched incident", () => {
    const r = signDeepLink({ incidentId, secret, ttlHours: 1 });
    const v = verifyDeepLink({ incidentId: "00000000-0000-0000-0000-000000000000", token: r.token, secret });
    expect(v.ok).toBe(false);
  });
  it("detects bad signature", () => {
    const r = signDeepLink({ incidentId, secret, ttlHours: 1 });
    const v = verifyDeepLink({ incidentId, token: r.token, secret: "wrong" });
    expect(v.ok).toBe(false);
  });
});
