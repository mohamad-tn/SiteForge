# SiteForge

Local visual site builder (Next.js 15 + Prisma + Postgres). Practical quality bar — not Framer parity.

## Getting started

Use the package manager for deps, schema, seed, and the dev server on port 3000.
Credentials and DB URL live in STATUS.txt and .env.example.

## Architecture notes

### Platform UI vs site content languages
- Platform chrome (sf-platform-lang, AR|EN only): buttons, inspector labels, dashboard, CMS, settings.
  Source: src/lib/platform-i18n.ts + src/lib/prop-labels.ts.
- Site content locales (content.locales / editLocale, AR|EN|FR|ES): canvas preview + published /s/[slug] only.
- Never mix the two. Editor toolbar: App UI language != Content language.

### Tenant model
- Every site has ownerId. Mutating APIs use helpers in src/lib/api.ts + src/lib/site-access.ts (owner or admin role).
- Public routes only see published data. Uploads require a session; SVG scanned. Custom CSS sanitized.

### Scripts (package.json)
- dev / build / start
- lint
- test (Vitest pure libs)
- database push and seed scripts

## Key paths
- src/lib/api.ts — session / owner / JSON errors
- src/lib/design.ts — SiteContent / Block / LocalizedString
- src/lib/platform-i18n.ts — platform chrome
- src/lib/prop-labels.ts — bilingual PROP / STYLE / MOTION labels
- src/components/editor/* — editor chrome


### External API connector + site secrets vault
Any **button**, **form**, or **CTA** (navbar / hero / cta) can call the customer own HTTP API:

1. Site tab -> **Site secrets** - add names (e.g. API_TOKEN); values encrypted server-side, never listed again.
2. Block inspector **API** -> enable, method, URL (pathParam ok).
3. Headers: pick vault secret for Authorization (Bearer template or secret:NAME) - do not paste raw keys into published JSON.
4. Prefer **proxy** mode. Publish. Runtime uses /api/s/[slug]/http which resolves vault placeholders + SSRF guards.

**Security:** proxy http(s) only; blocks localhost/private/metadata; timeout + size cap; log redaction. Vault values never appear in published JSON. Browser mode omits vault refs.

Key paths: src/lib/http-action.ts, src/lib/site-secrets.ts, src/app/api/sites/[id]/secrets/route.ts, src/app/api/s/[slug]/http/route.ts, src/components/editor/site-secrets-panel.tsx, src/components/editor/api-action-editor.tsx.

