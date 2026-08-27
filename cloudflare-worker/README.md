# Khaacho Cloudflare API

Cloudflare Workers migration for the live Khaacho/NepaCompare frontend. Phase 1 covers customer authentication, PostgreSQL access, and insurance quote comparison. WhatsApp and background jobs remain on the existing backend for a later phase.

## Endpoints

- `GET /health` — Worker + PostgreSQL health check
- `POST /auth/customer-register` — accepts `{ email, phone, password, name }`
- `POST /auth/customer-login` — accepts `{ email, password }`
- `GET /quotes?vertical=motor|health|life|travel&...` — returns the legacy quote shape used by the current frontend

`/api/...` aliases are also supported for the same endpoints.

## Database

This Worker is designed to connect to the existing NepaCompare PostgreSQL schema through Cloudflare Hyperdrive. It reads/writes the existing Prisma tables `User` and `Partner` directly with parameterized SQL, so Prisma is not required in the Worker runtime.

Cloudflare currently recommends `pg` with Hyperdrive for PostgreSQL Workers. Create the Hyperdrive binding using your existing PostgreSQL connection string:

```bash
cd cloudflare-worker
npm install
npx wrangler hyperdrive create khaacho-db --connection-string="postgresql://USER:PASSWORD@HOST:5432/DATABASE"
```

Then add the returned ID to `wrangler.jsonc`:

```jsonc
"hyperdrive": [
  {
    "binding": "HYPERDRIVE",
    "id": "YOUR_HYPERDRIVE_ID"
  }
]
```

## Secrets

Create a long random JWT signing secret:

```bash
npx wrangler secret put JWT_SECRET
```

Do not commit database credentials or JWT secrets to GitHub.

## Local development

```bash
npm install
npm run dev
```

The production CORS allowlist already contains:

- `https://khaacho.com`
- `https://www.khaacho.com`
- `http://localhost:3000`

## Deploy

After Hyperdrive and `JWT_SECRET` are configured:

```bash
npm run deploy
```

Then verify:

```bash
curl https://YOUR-WORKER.workers.dev/health
curl "https://YOUR-WORKER.workers.dev/quotes?vertical=motor&cc=150&year=2024"
```

## Authentication migration note

The previous NestJS backend stores customer passwords with bcrypt. The Worker stores new passwords using Web Crypto PBKDF2 to avoid CPU-heavy JavaScript bcrypt work in the Workers free tier. Existing bcrypt customer accounts are detected and receive a clear migration response instead of being treated as a wrong password. Before switching a production database with existing customer accounts, add a password-reset/migration flow.

## Frontend cutover

Once the Worker URL is healthy, set the live frontend API base URL to the Worker origin. The Worker intentionally preserves the existing routes and response shapes so the frontend should need only the API-host configuration change.
