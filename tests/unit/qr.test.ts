import { describe, expect, it } from "vitest";
import { buildQrPayload, isValidToken, parseQrPayload } from "@/lib/qr";

const token = "aB3_dE6-gH9jK2mN5pQ8rS1t";

describe("QR payload", () => {
  it("builds a scan URL with only the opaque token", () => {
    const url = buildQrPayload("https://spacio.example.com/", token);
    expect(url).toBe(`https://spacio.example.com/scan?t=${token}`);
    expect(new URL(url).searchParams.size).toBe(1);
  });

  it("round-trips through the parser", () => {
    expect(parseQrPayload(buildQrPayload("https://spacio.example.com", token))).toBe(token);
  });

  it("accepts a bare token (manual entry)", () => {
    expect(parseQrPayload(`  ${token}  `)).toBe(token);
  });

  it("rejects codes that aren't SPACIO codes", () => {
    for (const raw of [
      "https://example.com/other?t=" + token,
      "https://spacio.example.com/scan",
      "https://spacio.example.com/scan?t=short",
      "https://spacio.example.com/scan?t=" + encodeURIComponent("<script>alert(1)</script>"),
      "WIFI:S:campus;T:WPA;P:secret;;",
      "hello world",
      "",
    ]) {
      expect(parseQrPayload(raw), raw).toBeNull();
    }
  });

  it("validates token shape", () => {
    expect(isValidToken(token)).toBe(true);
    expect(isValidToken("a".repeat(15))).toBe(false);
    expect(isValidToken("a".repeat(65))).toBe(false);
    expect(isValidToken("abc def ghi jkl mno")).toBe(false);
  });
});
