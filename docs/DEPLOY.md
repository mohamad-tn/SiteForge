# Deploy SiteForge (free path)

## Why this stack
- **Vercel** blocked without phone SMS → skipped.
- **Neon** — free Postgres (durable).
- **Render** — free Node web service + **auto-deploy on every GitHub push** to `main`.
- Build runs `prisma migrate deploy` so schema updates ship with code.

## One-time setup

### 1) Neon database
1. Sign up at https://console.neon.tech (GitHub login works).
2. Create project `siteforge` → copy the connection string (`DATABASE_URL`).
3. Prefer the pooled URL if Neon shows one (add `?sslmode=require` if missing).

### 2) Render web service
1. Sign up at https://dashboard.render.com with GitHub.
2. **New → Blueprint** and select `mohamad-tn/SiteForge`, **or**
   **New → Web Service** → this repo → branch `main`.
3. Runtime: Node · Build: `pnpm install --frozen-lockfile && pnpm build` · Start: `pnpm start`.
4. Plan: **Free**.
5. Environment variables:
   - `DATABASE_URL` = Neon URL
   - `NEXTAUTH_URL` = `https://<your-service>.onrender.com` (update after first URL is known)
   - `NEXTAUTH_SECRET` = long random (Render can generate)
   - `SECRETS_VAULT_KEY` = 32+ byte random (or leave empty only for first boot if app allows)

### 3) First seed (once)
After the first successful deploy, open **Render Shell** on the service and run:

```bash
pnpm db:seed:prod
```

Demo: `demo@siteforge.local` / `demo1234` · Admin: `admin@siteforge.local` / `admin1234`

### 4) CI/CD
Render watches GitHub `main`. Every push rebuilds; `prisma migrate deploy` applies new migrations automatically.
**Do not** run seed on every deploy.

## Notes
- Free Render services **sleep** after idle ~15m (first request may be slow).
- Uploaded files on free disk are **ephemeral** — use external storage later for production media.
- Keep `.env` out of git (already gitignored).
