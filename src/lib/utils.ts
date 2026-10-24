export function slugify(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "item";
}

export function founderSlug(name: string, id: string) {
  return `${slugify(name)}-${id.slice(-6)}`;
}

export function displayName(user: { fullName?: string | null; name?: string | null; email?: string | null }) {
  return user.fullName || user.name || user.email?.split("@")[0] || "Misfit founder";
}

export function profileImage(user: { profilePicture?: string | null; image?: string | null }) {
  return user.profilePicture || user.image || null;
}

export function truncate(value: string, maximum = 50) {
  if (value.length <= maximum) return value;
  return `${value.slice(0, Math.max(0, maximum - 1)).trimEnd()}…`;
}

export function instagramUrl(handle: string) {
  const clean = handle.replace(/^@/, "").trim();
  return `https://instagram.com/${encodeURIComponent(clean)}`;
}

export function absoluteUrl(path = "/") {
  const origin = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return new URL(path, origin).toString();
}
