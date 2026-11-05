import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Enter your college email address.")
  .max(254, "That email address is too long.")
  .email("Enter a valid email address, like name@srmist.edu.in.");

export function emailDomain(email: string): string {
  const at = email.lastIndexOf("@");
  return at === -1 ? "" : email.slice(at + 1).trim().toLowerCase();
}

/** Exact domain match — subdomains and look-alikes are not accepted. */
export function isAllowedEmail(email: string, allowed: string[]): boolean {
  const domain = emailDomain(email);
  return domain.length > 0 && allowed.map((d) => d.toLowerCase()).includes(domain);
}

export function otpSchema(length: number) {
  return z
    .string()
    .trim()
    .regex(new RegExp(`^[0-9]{${length}}$`), `Enter the ${length}-digit code from your email.`);
}

export const profileSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, "Enter your name (at least 2 characters).")
    .max(80, "Keep your name under 80 characters.")
    .regex(/^[\p{L}\p{M}' .-]+$/u, "Use letters, spaces, apostrophes, dots or hyphens."),
  register_number: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{4,20}$/, "Register numbers are 4–20 letters or digits.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});
