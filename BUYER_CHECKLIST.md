# Buyer checklist (honest)

## Included
- Auth (credentials), dashboard, visual editor with pages/layers/insert/inspector
- Draft != publish snapshot at /s/[slug]
- Platform UI language (AR|EN) separate from site content locales (AR|EN|FR|ES)
- Lite CMS collections + form submissions inbox
- External API connector + server-side SiteSecret vault (proxy; placeholders in published JSON)
- Local media uploads, SEO fields, custom CSS (sanitized, trusted-tenant)
- Admin overview (users/sites/domains metrics)
- Vitest coverage for sanitize-css, i18n helpers, localized get/set, block-style encode, http-action SSRF/buildRequest, site-secrets resolution

## Not included (do not expect)
- Framer freeform canvas, variants, timeline, collaboration
- Real TLS/CDN hosting or managed domains (CNAME UI is a stub)
- Full relational CMS / commerce
- Production CDN for uploads
- Full saved API connection library / OAuth / multi-env secret rotation UI

## How to verify
1. Login demo — switch App UI EN, Content language EN/AR independently in editor
2. Unauthenticated POST /api/uploads — 401
3. Authenticated GET /api/sites/<fake-id> — 404 { error }
4. Publish — /s/demo-studio form submit succeeds
4b. Site secrets add API_TOKEN; Form API tab Bearer+secret (proxy); publish; JSON has secret:NAME only
5. Run package scripts: test and lint (changed surfaces clean); build succeeds

See STATUS.txt for readiness score and gaps.
