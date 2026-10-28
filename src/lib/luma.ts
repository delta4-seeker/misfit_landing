const LUMA_HOSTS = new Set(["luma.com", "www.luma.com", "lu.ma", "www.lu.ma"]);

export const DEFAULT_LUMA_CALENDAR_URL = "https://luma.com/user/misfitfounders";

export function normalizeLumaUrl(value: string) {
  const url = new URL(value.trim());
  if (url.protocol !== "https:" || !LUMA_HOSTS.has(url.hostname.toLowerCase()) || url.username || url.password || url.port) {
    throw new Error("Use a secure Luma link (https://luma.com/… or https://lu.ma/…).");
  }
  url.hash = "";
  return url.toString();
}

export async function resolveLumaEvent(value: string) {
  let url = normalizeLumaUrl(value);
  const signal = AbortSignal.timeout(10_000);

  for (let redirectCount = 0; redirectCount < 4; redirectCount += 1) {
    const response = await fetch(url, { cache: "no-store", redirect: "manual", signal });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Luma did not return an event page.");
      url = normalizeLumaUrl(new URL(location, url).toString());
      continue;
    }
    if (!response.ok) throw new Error("Luma could not open that event link. Check the URL and try again.");
    const html = await response.text();
    const eventId = html.match(/app-argument=luma:\/\/event\/(evt-[A-Za-z0-9_-]+)/)?.[1];
    if (!eventId) throw new Error("This link does not appear to be a public Luma event page.");
    return { url, eventId };
  }

  throw new Error("Luma redirected too many times. Use the final public event URL.");
}
