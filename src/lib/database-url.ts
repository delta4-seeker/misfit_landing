const DEFAULT_SUPABASE_PROJECT_REF = "adjjtejmrmzjqoasjhtp";
const DEFAULT_SUPABASE_POOLER_HOST = "aws-0-ap-northeast-1.pooler.supabase.com";

function passwordConnectionUrl() {
  const password = process.env.SUPABASE_DB_PASSWORD;
  if (!password) return undefined;

  const projectRef = process.env.SUPABASE_PROJECT_REF || DEFAULT_SUPABASE_PROJECT_REF;
  const poolerHost = process.env.SUPABASE_POOLER_HOST || DEFAULT_SUPABASE_POOLER_HOST;
  return `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@${poolerHost}:5432/postgres?sslmode=require&connection_limit=2&pool_timeout=20`;
}

export function databaseUrl() {
  return process.env.DATABASE_URL || passwordConnectionUrl();
}

export function directDatabaseUrl() {
  return process.env.DIRECT_URL || databaseUrl();
}

export function databaseIsConfigured() {
  return Boolean(databaseUrl());
}
