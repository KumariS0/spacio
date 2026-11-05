import { describe, expect, it } from "vitest";
import { buildPassPayload, buildQrPayload, parsePassPayload, parseQrPayload } from "@/lib/qr";

const TOKEN = "Zq3k9_X-2bVt7LmNp4RsWy8hJcFdA1uE6oTgKiHvB0x";

describe("booking pass payload", () => {
  it("round-trips a token through the pass link", () => {
    const payload = buildPassPayload("https://spacio.example/", TOKEN);
    expect(payload).toBe(`https://spacio.example/admin/scan?p=${TOKEN}`);
    expect(parsePassPayload(payload)).toBe(TOKEN);
  });

  it("accepts a bare pass code typed by staff", () => {
    expect(parsePassPayload(`  ${TOKEN} `)).toBe(TOKEN);
  });

  it("rejects other links, malformed codes and entrance QR links", () => {
    expect(parsePassPayload("https://evil.example/phish?p=" + TOKEN)).toBeNull();
    expect(parsePassPayload("https://spacio.example/admin/scan?p=short")).toBeNull();
    expect(parsePassPayload(buildQrPayload("https://spacio.example", TOKEN))).toBeNull();
    expect(parsePassPayload("hello world")).toBeNull();
  });

  it("an entrance QR reader doesn't treat a pass link as a facility code", () => {
    expect(parseQrPayload(buildPassPayload("https://spacio.example", TOKEN))).toBeNull();
  });

  it("contains nothing but the site link and the random token", () => {
    const url = new URL(buildPassPayload("https://spacio.example", TOKEN));
    expect([...url.searchParams.keys()]).toEqual(["p"]);
  });
});
