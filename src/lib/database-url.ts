const DEFAULT_SUPABASE_PROJECT_REF = "adjjtejmrmzjqoasjhtp";
const DEFAULT_SUPABASE_POOLER_HOST = "aws-0-ap-northeast-1.pooler.supabase.com";

function passwordConnectionUrl(mode: "runtime" | "direct") {
  const password = process.env.SUPABASE_DB_PASSWORD;
  if (!password) return undefined;

  const projectRef = process.env.SUPABASE_PROJECT_REF || DEFAULT_SUPABASE_PROJECT_REF;
  const poolerHost = process.env.SUPABASE_POOLER_HOST || DEFAULT_SUPABASE_POOLER_HOST;
  const runtime = mode === "runtime";
  const port = runtime ? 6543 : 5432;
  const options = new URLSearchParams({
    sslmode: "require",
    // Pages and image requests run concurrently; a single connection serialized
    // every request and caused image optimizer timeouts under normal browsing.
    connection_limit: runtime ? "5" : "2",
    pool_timeout: "30",
  });
  if (runtime) options.set("pgbouncer", "true");
  return `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@${poolerHost}:${port}/postgres?${options}`;
}

export function databaseUrl() {
  const configured = process.env.DATABASE_URL;
  if (!configured) return passwordConnectionUrl("runtime");
  try {
    const url = new URL(configured);
    // Vercel may provide its own DATABASE_URL with the old single-connection
    // setting, bypassing the password-based URL above.
    if (url.hostname.endsWith(".pooler.supabase.com") || url.searchParams.get("pgbouncer") === "true") {
      const limit = Number(url.searchParams.get("connection_limit") || 0);
      if (limit < 5) url.searchParams.set("connection_limit", "5");
      const timeout = Number(url.searchParams.get("pool_timeout") || 0);
      if (timeout < 30) url.searchParams.set("pool_timeout", "30");
    }
    return url.toString();
  } catch {
    return configured;
  }
}

export function directDatabaseUrl() {
  return process.env.DIRECT_URL || passwordConnectionUrl("direct") || process.env.DATABASE_URL;
}

export function databaseIsConfigured() {
  return Boolean(databaseUrl());
}
