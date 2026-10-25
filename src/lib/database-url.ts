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
    connection_limit: runtime ? "1" : "2",
    pool_timeout: "20",
  });
  if (runtime) options.set("pgbouncer", "true");
  return `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@${poolerHost}:${port}/postgres?${options}`;
}

export function databaseUrl() {
  return process.env.DATABASE_URL || passwordConnectionUrl("runtime");
}

export function directDatabaseUrl() {
  return process.env.DIRECT_URL || passwordConnectionUrl("direct") || process.env.DATABASE_URL;
}

export function databaseIsConfigured() {
  return Boolean(databaseUrl());
}
