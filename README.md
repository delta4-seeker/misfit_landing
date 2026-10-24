# Misfit Founders Club

The portal now runs on Next.js App Router, Auth.js, Prisma, Supabase Postgres, and Supabase Storage. It includes the public club site, product directory, founder profiles, direct-to-Luma events, gallery, newsletter capture, Google login, profile completion, product submission, and a role-gated club dashboard.

## Local setup

Requirements: Node.js 20.9 or newer and a Supabase project.

```bash
npm install
cp .env.local.example .env.local
npm run db:migrate
npm run db:seed
npm run dev
```

Open `http://localhost:3000`. Public pages render representative demo content when no database is configured, but login, profiles, submissions, and admin require Supabase.

## Environment

All secrets remain in `.env.local` locally and in the deployment provider's encrypted environment settings in production. Do not commit either file.

- `DATABASE_URL`: Supabase transaction-pooler URI on port 6543 for the deployed serverless app. Add `pgbouncer=true&connection_limit=1`.
- `DIRECT_URL`: Supabase session-pooler URI on port 5432 for Prisma migrations, seeds, and imports.
- `SUPABASE_PROJECT_REF`, `SUPABASE_POOLER_HOST`, and `SUPABASE_DB_PASSWORD`: IPv4 session-pooler fallback for local development when full database URLs have not been added yet.
- `AUTH_SECRET`: a random session secret; generate one with `openssl rand -base64 32`.
- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`: Google OAuth web client credentials.
- `NEXT_PUBLIC_SITE_URL`: `http://localhost:3000` locally and `https://misfitfoundersclub.com` in production.
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`: Supabase project API settings. The service-role key is server-only.
- `SUPABASE_STORAGE_BUCKET`: public image bucket, normally `misfit-media`.
- `SEED_ADMIN_EMAIL`: defaults to `9165prashant@gmail.com`.

Create a public Supabase Storage bucket named `misfit-media`. The app validates uploaded image type and size before writing to that bucket.

## Google OAuth callbacks

Add these authorized redirect URIs to the Google OAuth web client:

```text
http://localhost:3000/api/auth/callback/google
https://misfitfoundersclub.com/api/auth/callback/google
```

Auth.js reads the member's verified Google name and profile photo. New accounts are prefilled with them, and existing accounts receive them on the next Google sign-in when those fields are blank.

## Deploy

Vercel is the lowest-friction host for this Next.js build:

1. Push the project to a Git repository and import it into Vercel.
2. Add the variables from `.env.local.example` to the Vercel project.
3. Run `npm run db:migrate` once against `DIRECT_URL`, then `npm run db:seed` if this is a fresh database.
4. Point `misfitfoundersclub.com` at Vercel and add the production Google callback above.
5. Deploy. Vercel runs `npm run build` automatically.

## Verification

```bash
npm run typecheck
npm run lint
npm run build
npm audit --omit=dev
npm run check:backend
npm run check:storage
npm run check:admin
npm run check:http
npm run check:security
```

Run the HTTP and security checks against a production build when preparing a release. Image uploads are intentionally disabled in production until `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are configured; the local filesystem fallback is development-only.

Core routes:

- `/products`, `/events`, `/gallery` — public portal
- `/profile` — current founder profile editor
- `/products/new` — authenticated product submission
- `/admin` — club administrators only
- `/api/health`, `/sitemap.xml`, `/robots.txt` — operations and SEO
