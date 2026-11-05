import { describe, expect, it } from "vitest";
import { emailDomain, emailSchema, isAllowedEmail, otpSchema, profileSchema } from "@/lib/auth/domains";

const allowed = ["srmist.edu.in"];

describe("email domain checks", () => {
  it("accepts the configured domain, case-insensitively", () => {
    expect(isAllowedEmail("ab1234@srmist.edu.in", allowed)).toBe(true);
    expect(isAllowedEmail("AB1234@SRMIST.EDU.IN", allowed)).toBe(true);
  });

  it("rejects other domains, subdomains and look-alikes", () => {
    for (const email of [
      "someone@gmail.com",
      "x@mail.srmist.edu.in",
      "x@srmist.edu.in.evil.com",
      "x@srmist-edu.in",
      "x@evilsrmist.edu.in",
      "srmist.edu.in@gmail.com",
      "no-at-sign",
      "",
    ]) {
      expect(isAllowedEmail(email, allowed), email).toBe(false);
    }
  });

  it("uses the last @ when extracting the domain", () => {
    expect(emailDomain("a@b@srmist.edu.in")).toBe("srmist.edu.in");
    expect(isAllowedEmail("\"x@srmist.edu.in\"@gmail.com", allowed)).toBe(false);
  });

  it("supports several configured domains", () => {
    expect(isAllowedEmail("a@srmap.edu.in", ["srmist.edu.in", "srmap.edu.in"])).toBe(true);
  });

  it("normalises and validates email input", () => {
    expect(emailSchema.parse("  Name@SRMIST.edu.in ")).toBe("name@srmist.edu.in");
    expect(emailSchema.safeParse("not an email").success).toBe(false);
  });
});

describe("OTP code", () => {
  it("accepts exactly N digits", () => {
    expect(otpSchema(6).safeParse("123456").success).toBe(true);
    expect(otpSchema(6).safeParse(" 012345 ").success).toBe(true);
    expect(otpSchema(8).safeParse("12345678").success).toBe(true);
  });

  it("rejects wrong length, letters and symbols", () => {
    for (const code of ["12345", "1234567", "12a456", "dddddd", "12 456", "", "１２３４５６"]) {
      expect(otpSchema(6).safeParse(code).success, code).toBe(false);
    }
  });
});

describe("profile form", () => {
  it("accepts names with apostrophes and accents and uppercases register numbers", () => {
    const r = profileSchema.parse({ full_name: "Anaïs O'Neil-Rao", register_number: "ra2211003010123" });
    expect(r.register_number).toBe("RA2211003010123");
  });

  it("treats an empty register number as not provided", () => {
    expect(profileSchema.parse({ full_name: "Priya", register_number: "" }).register_number).toBeUndefined();
  });

  it("rejects markup and too-short names", () => {
    expect(profileSchema.safeParse({ full_name: "<script>" }).success).toBe(false);
    expect(profileSchema.safeParse({ full_name: "A" }).success).toBe(false);
  });
});
