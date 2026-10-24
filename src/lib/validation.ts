import { z } from "zod";

export function isSecureExternalUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

export const secureExternalUrlSchema = z.string()
  .trim()
  .max(2048, "Keep URLs under 2,048 characters.")
  .refine(isSecureExternalUrl, "Use a secure https:// URL without embedded credentials.");

export const instagramHandleSchema = z.string()
  .trim()
  .max(100)
  .transform((value) => value
    .replace(/^@/, "")
    .replace(/^https?:\/\/(?:www\.)?instagram\.com\//i, "")
    .replace(/\/$/, ""))
  .refine((value) => !value || /^[a-zA-Z0-9._]{1,30}$/.test(value), "Enter a valid Instagram handle.");
