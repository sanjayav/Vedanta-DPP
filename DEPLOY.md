# Deploying the C6 Trail · Vedanta · Hindustan Zinc DPP platform

The platform is three services: two Next.js apps and one FastAPI backend. The
recommended cloud split is:

| Service               | Where                | Why                                                     |
| --------------------- | -------------------- | ------------------------------------------------------- |
| `apps/web-public`     | **Vercel**           | SSR, edge cache, free tier                              |
| `apps/web-console`    | **Vercel**           | SSR, role-cookie auth, sits next to the public viewer   |
| `apps/api` (FastAPI)  | **Railway / Render / Fly** | Long-lived asyncpg pool · RLS session bind · Alembic |
| Postgres              | **Neon**             | Serverless Postgres · branching · already in `.env`     |
| Redis (rate limit)    | **Upstash**          | Serverless Redis with REST                              |
| Object storage (opt.) | **Cloudflare R2 / S3** | DPP bundles, exports — Sprint-5+ feature             |

You can host the API on Vercel as serverless Python functions if you want
all-Vercel, but you'll fight cold starts, the per-request asyncpg pool, and
the lack of a place to run Alembic. The split below is much smoother.

---

## 1 · Provision the data layer (5 min)

### Postgres — Neon

1. Sign up at <https://console.neon.tech>.
2. Create a project (region near your users; `aws-eu-central-1` for EU).
3. Copy the two connection strings Neon gives you. They look like:

   ```
   postgresql://neondb_owner:••••@ep-xxx-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```

4. Save them — you'll set them on the API service as:

   - `DATABASE_URL` → `postgresql+asyncpg://…?ssl=require`
   - `DATABASE_URL_SYNC` → `postgresql+psycopg://…?sslmode=require` (the same role works locally; in prod you'll want a non-superuser app role — see "RLS in production" below).
   - `DATABASE_URL_SYNC_ADMIN` → leave equal to `DATABASE_URL_SYNC` for now (Neon role is the schema owner).

### Redis — Upstash

1. Sign up at <https://upstash.com>.
2. Create a Redis database (Global, default settings).
3. Copy the **Redis URL** (`rediss://…`).
4. Save it as `REDIS_URL` on the API service.

---

## 2 · Deploy the API (FastAPI)

### Option A · Railway (simplest)

1. <https://railway.app> → **New Project** → **Deploy from GitHub** → pick this repo.
2. Set **Root Directory** to `apps/api`.
3. Build command:

   ```
   pip install uv && uv sync --frozen
   ```

4. Start command:

   ```
   uv run alembic upgrade head && uv run uvicorn dpp_api.main:app --host 0.0.0.0 --port $PORT
   ```

5. Add the env vars from `.env` (see the **API env vars** section below).
6. Deploy. Copy the public URL (`https://your-api.up.railway.app`).

### Option B · Render

1. <https://render.com> → **New Web Service** → connect this repo.
2. Root Directory `apps/api`, runtime **Python 3.12**.
3. Build: `pip install uv && uv sync --frozen`
4. Start: `uv run alembic upgrade head && uv run uvicorn dpp_api.main:app --host 0.0.0.0 --port $PORT`
5. Same env vars as above.

### Option C · Fly.io

The repo doesn't yet ship a `fly.toml` — `fly launch` from `apps/api/` is the
fastest path. Pick "Don't deploy yet" so you can set env vars before first
boot.

---

## 3 · Deploy the two Next.js apps to Vercel

You'll create **two Vercel projects** — one per app — both pointed at the
same GitHub repo.

### web-public

1. <https://vercel.com/new> → **Import Git Repository** → pick this repo.
2. **Project Name**: `c6trail-web-public` (or whatever you like).
3. **Root Directory**: `apps/web-public` ← critical, click *Edit*.
4. **Framework Preset**: Vercel autodetects Next.js. Leave it.
5. **Build / Install commands**: leave **blank** — the `vercel.json` in
   `apps/web-public/` already provides them. (`pnpm --filter` so the
   workspace packages compile in.)
6. **Environment Variables** — add:

   | Key                          | Value                                          |
   | ---------------------------- | ---------------------------------------------- |
   | `NEXT_PUBLIC_API_BASE_URL`   | `https://your-api.up.railway.app`              |
   | `NEXT_PUBLIC_RESOLVER_BASE_URL` | `https://your-public.vercel.app/dpp` (set after first deploy) |

7. Click **Deploy**. Wait ~90s.

### web-console

Repeat the steps with **Root Directory = `apps/web-console`**, plus these
extra env vars (the console signs JWTs locally for dev / pre-OIDC tenants):

| Key                       | Value                                                                |
| ------------------------- | -------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_BASE_URL`| `https://your-api.up.railway.app`                                    |
| `DPP_JWT_ISSUER`          | `https://idp.your-tenant.example` (anything stable)                  |
| `DPP_JWT_AUDIENCE`        | `dpp-api`                                                            |
| `DPP_JWT_DEV_SECRET`      | A 32+-char random string. **Keep identical** to the API's secret.    |
| `DPP_ENV`                 | `production`                                                         |

> **Important**: `DPP_JWT_DEV_SECRET` must match the value you set on the API.
> The console mints HS256 tokens with this secret; the API verifies them.

---

## 4 · API env vars (set on Railway/Render/Fly)

| Key                          | Notes                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------ |
| `DPP_ENV`                    | `production`                                                                         |
| `DATABASE_URL`               | Neon URL — `postgresql+asyncpg://…?ssl=require`                                      |
| `DATABASE_URL_SYNC`          | Same DB — `postgresql+psycopg://…?sslmode=require`                                  |
| `DATABASE_URL_SYNC_ADMIN`    | Same as `DATABASE_URL_SYNC` for first deploy                                         |
| `REDIS_URL`                  | Upstash `rediss://…`                                                                 |
| `DPP_JWT_DEV_SECRET`         | 32+-char random string · **must match** the console's value                          |
| `DPP_JWT_ISSUER`             | `https://idp.your-tenant.example`                                                    |
| `DPP_JWT_AUDIENCE`           | `dpp-api`                                                                            |
| `DPP_ISSUER_DID`             | `did:web:your-public.vercel.app`                                                     |
| `DPP_ISSUER_KEY_PATH`        | Bake the Ed25519 PEM as a base64 secret + decode at boot, OR mount via the platform's secret-files feature. |
| `DPP_RESOLVER_BASE_URL`      | `https://your-public.vercel.app/dpp` (the public viewer's base)                      |
| `DPP_DEFAULT_TENANT_ID`      | `1`                                                                                  |
| `DPP_DEFAULT_TENANT_SLUG`    | `hzl`                                                                                |
| `CORS_ORIGINS`               | `https://your-public.vercel.app,https://your-console.vercel.app`                     |

---

## 5 · First-boot sequence

1. Deploy the API (it'll fail to start until the DB is reachable; Neon is
   reachable as soon as you set the URL).
2. The dev bootstrap (`apps/api/dpp_api/services/bootstrap.py`) runs on
   first lifespan and seeds the HZL tenant + canonical product/manifest
   data. **Disable it for production** by setting `DPP_ENV=production` —
   the lifespan only fires the seed when `not settings.is_production`.
   That means in prod you have to run the seed by hand:

   ```bash
   curl -X POST https://your-api.up.railway.app/api/v1/products/seed \
     -H "Authorization: Bearer <tenant_admin JWT>"
   ```

3. Redeploy the two Vercel projects so they pick up the API URL.
4. Visit `https://your-public.vercel.app/` and `https://your-console.vercel.app/`.

---

## 6 · RLS in production (read this if you skip nothing else)

The local dev stack uses the bootstrap superuser `dpp` for both migrations
and runtime, then a non-superuser `dpp_app` for runtime so RLS actually
fires. **The same split applies in prod** — Neon roles bypass RLS by default.

After the first deploy:

1. Connect to Neon as the bootstrap user and create a non-superuser app role:

   ```sql
   CREATE ROLE dpp_app WITH LOGIN PASSWORD '••••••••' NOSUPERUSER NOBYPASSRLS NOINHERIT;
   GRANT CONNECT ON DATABASE neondb TO dpp_app;
   GRANT USAGE, CREATE ON SCHEMA public TO dpp_app;
   GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO dpp_app;
   GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO dpp_app;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO dpp_app;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO dpp_app;
   ```

2. Update `DATABASE_URL` on the API service to use `dpp_app:•••@…` and
   redeploy. Keep `DATABASE_URL_SYNC_ADMIN` pointed at the bootstrap role
   so Alembic migrations still run as the schema owner.

If you skip this, RLS policies are silently bypassed and tenant isolation
is theatrical — same gotcha that bit us locally.

---

## 7 · Custom domains

1. Vercel → each project → **Settings → Domains** → add your domain.
2. Add the equivalent CNAME or A record at your DNS provider (Vercel UI
   shows the value).
3. Update `CORS_ORIGINS` on the API and `NEXT_PUBLIC_API_BASE_URL` on the
   web apps to match.

---

## 8 · Auth (when you outgrow the dev secret)

The console signs HS256 JWTs locally with `DPP_JWT_DEV_SECRET` because
v1.0 doesn't ship OIDC. Production needs Microsoft Entra (per SDD §12).
Wire it up by:

1. Register an app in Entra, set redirect URI to
   `https://your-console.vercel.app/api/auth/callback`.
2. Drop the IdP's JWKS URL into a new env var `DPP_JWT_JWKS_URL`.
3. The API's `auth/jwt_verify.py` already supports JWKS verification when
   the URL is set — it stops accepting the dev secret in production.

---

## 9 · Troubleshooting

| Symptom                                    | Fix                                                                  |
| ------------------------------------------ | -------------------------------------------------------------------- |
| Vercel build can't find `@dpp/ui`          | Confirm `Root Directory` is the app folder, not the repo root, and `vercel.json` is present. |
| Vercel build OOM during `next build`       | In project settings, bump to a paid plan or split the build (`turbo-ignore` already keeps unrelated changes from rebuilding). |
| API 401 on every request                   | `DPP_JWT_DEV_SECRET` differs between API and console. Re-set both to the same string. |
| All requests cross-tenant leak             | You're connected as the schema owner. Switch `DATABASE_URL` to the `dpp_app` role (see §6). |
| `/api/v1/dpps/` returns empty in prod      | The dev bootstrap is gated to `DPP_ENV != production`. Run `/api/v1/products/seed` manually after first deploy. |

---

You can now `git push` and Vercel + Railway/Render auto-redeploy on every
commit to `main`.
