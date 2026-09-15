/**
 * Allowlisted AI patches for draft site content.
 * Never evaluates JS / shell; every patch validated with zod against existing schemas.
 */
import { z } from "zod";
import {
  blockSchema,
  blockTypes,
  defaultPropsFor,
  designTokensSchema,
  ensureNavItems,
  LOCALE_CODES,
  siteContentSchema,
  syncLinksCsvFromNavItems,
  type Block,
  type BlockType,
  type DesignTokens,
  normalizeActionType,
  type NavItem,
  type SiteContent,
} from "@/lib/design";
import { normalizeHref } from "@/lib/href";
import { setPartStyles, type PartStyle } from "@/lib/block-parts";
import { SITEFORGE_PLAYBOOK } from "@/lib/ai/siteforge-playbook";

const HREF_KEYS = new Set(["href", "ctaHref", "buttonHref", "secondaryHref"]);

const localeCodeSchema = z.string().min(2).max(12);

export const aiPatchSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("update_prop"),
    pageId: z.string().min(1),
    blockId: z.string().min(1),
    key: z.string().min(1).max(64),
    value: z.unknown(),
  }),
  z.object({
    op: z.literal("update_props"),
    pageId: z.string().min(1),
    blockId: z.string().min(1),
    props: z.record(z.string(), z.unknown()),
  }),
  z.object({
    op: z.literal("set_part_style"),
    pageId: z.string().min(1),
    blockId: z.string().min(1),
    part: z.string().min(1).max(80),
    styles: z.record(z.string(), z.string()),
  }),
  z.object({
    op: z.literal("add_block"),
    pageId: z.string().min(1),
    type: z.enum(blockTypes),
    props: z.record(z.string(), z.unknown()).optional(),
    afterBlockId: z.string().optional(),
    id: z.string().optional(),
  }),
  z.object({
    op: z.literal("remove_block"),
    pageId: z.string().min(1),
    blockId: z.string().min(1),
  }),
  z.object({
    op: z.literal("duplicate_block"),
    pageId: z.string().min(1),
    blockId: z.string().min(1),
    id: z.string().optional(),
  }),
  z.object({
    op: z.literal("update_copy"),
    pageId: z.string().min(1),
    blockId: z.string().min(1),
    key: z.string().min(1).max(64),
    locale: localeCodeSchema,
    value: z.string().max(8000),
  }),
  z.object({
    op: z.literal("add_page"),
    id: z.string().optional(),
    title: z.string().min(1).max(120),
    slug: z.string().min(1).max(80),
    afterPageId: z.string().optional(),
  }),
  z.object({
    op: z.literal("remove_page"),
    pageId: z.string().min(1),
  }),
  z.object({
    op: z.literal("rename_page"),
    pageId: z.string().min(1),
    title: z.string().min(1).max(120),
  }),
  z.object({
    op: z.literal("set_page_slug"),
    pageId: z.string().min(1),
    slug: z.string().min(1).max(80),
  }),
  z.object({
    op: z.literal("set_page_layout"),
    pageId: z.string().min(1),
    layout: z.enum(["flow", "canvas"]),
  }),
  z.object({
    op: z.literal("reorder_blocks"),
    pageId: z.string().min(1),
    blockIds: z.array(z.string().min(1)).min(1).max(200),
  }),
  z.object({
    op: z.literal("set_seo"),
    pageId: z.string().min(1),
    seoTitle: z.string().max(200).optional(),
    seoDescription: z.string().max(500).optional(),
    seoOgImage: z.string().max(500).optional(),
  }),
  z.object({
    op: z.literal("update_tokens"),
    tokens: z.record(z.string(), z.unknown()),
  }),
  z.object({
    op: z.literal("set_locales"),
    locales: z.array(localeCodeSchema).min(1).max(12),
    defaultLocale: localeCodeSchema.optional(),
  }),
  z.object({
    op: z.literal("set_default_locale"),
    defaultLocale: localeCodeSchema,
  }),
  z.object({
    op: z.literal("set_block_flags"),
    pageId: z.string().min(1),
    blockId: z.string().min(1),
    locked: z.boolean().optional(),
    hidden: z.boolean().optional(),
    zIndex: z.union([z.number(), z.string()]).optional(),
    stackId: z.string().max(64).nullable().optional(),
  }),
  z.object({
    op: z.literal("propose_domain"),
    domain: z.string().min(3).max(255),
  }),
  z.object({
    op: z.literal("set_nav_items"),
    pageId: z.string().min(1),
    blockId: z.string().min(1),
    items: z
      .array(
        z.object({
          label: z.union([
            z.string().min(1).max(200),
            z.record(z.string(), z.string()),
          ]),
          linkPageSlug: z.string().max(80).optional(),
          href: z.string().max(500).optional(),
          linkMode: z.string().max(32).optional(),
          id: z.string().max(64).optional(),
        })
      )
      .min(1)
      .max(40),
  }),
  z.object({
    op: z.literal("wire_nav_to_pages"),
    pageId: z.string().min(1).optional(),
  }),
  z.object({
    op: z.literal("set_button_link"),
    pageId: z.string().min(1),
    blockId: z.string().min(1),
    linkMode: z.enum(["page", "url", "collection"]),
    linkPageSlug: z.string().max(80).optional(),
    href: z.string().max(500).optional(),
    linkCollectionSlug: z.string().max(80).optional(),
    key: z.enum(["ctaHref", "href", "buttonHref"]).optional(),
  }),
]);

export type AiPatch = z.infer<typeof aiPatchSchema>;

export const aiPatchesResponseSchema = z.object({
  summary: z.string().max(500).optional(),
  patches: z.array(aiPatchSchema).max(24),
});

export type AiPatchesResponse = z.infer<typeof aiPatchesResponseSchema>;

const FORBIDDEN_PROP_KEYS = new Set([
  "httpAction",
  "customCss",
  "motionTimeline",
]);

const ALLOWED_TOKEN_TOP = new Set([
  "colors",
  "colorsDark",
  "fonts",
  "spacing",
  "radius",
  "rtl",
  "themeMode",
]);

function sanitizeNavItem(item: unknown, index: number): NavItem | null {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const o = item as Record<string, unknown>;
  const label =
    typeof o.label === "string" ||
    (o.label && typeof o.label === "object" && !Array.isArray(o.label))
      ? (o.label as NavItem["label"])
      : typeof o.title === "string"
        ? o.title
        : `Link ${index + 1}`;
  const href = typeof o.href === "string" ? normalizeHref(o.href) : "";
  const nav: NavItem = {
    id: typeof o.id === "string" && o.id ? o.id.slice(0, 64) : `nav-${index}`,
    label,
    href,
    linkMode: typeof o.linkMode === "string" ? o.linkMode.slice(0, 32) : "url",
    linkPageSlug:
      typeof o.linkPageSlug === "string" ? o.linkPageSlug.slice(0, 80) : "",
    linkCollectionSlug:
      typeof o.linkCollectionSlug === "string"
        ? o.linkCollectionSlug.slice(0, 80)
        : "",
    openInNewTab:
      typeof o.openInNewTab === "string" ? o.openInNewTab.slice(0, 8) : "",
    actionType: normalizeActionType(o.actionType),
  };
  if (typeof o.actionTarget === "string" && o.actionTarget) {
    nav.actionTarget = o.actionTarget.slice(0, 80);
  }
  return nav;
}

export type PageSlugRef = { id: string; slug: string; title: string };

/** Normalize title/label for fuzzy page matching (ar/en). */
export function normalizePageTitleKey(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}

/**
 * Resolve a model-supplied page target to a real page.slug.
 * Matches: exact slug (ci), page id, normalized title, href path last segment / ?p= query.
 */
export function resolvePageSlugRef(
  raw: string | null | undefined,
  pages: PageSlugRef[]
): string | null {
  if (raw == null || typeof raw !== "string") return null;
  let candidate = raw.trim();
  if (!candidate) return null;

  // ?p=slug (absolute or relative)
  if (/[?&]p=/.test(candidate)) {
    try {
      const u = candidate.includes("://")
        ? new URL(candidate)
        : new URL(candidate, "https://siteforge.local");
      const q = u.searchParams.get("p");
      if (q) candidate = q;
    } catch {
      const m = /[?&]p=([^&/#]+)/.exec(candidate);
      if (m) candidate = decodeURIComponent(m[1]);
    }
  } else if (candidate.includes("/") || candidate.startsWith("/")) {
    const path = candidate.split(/[?#]/)[0];
    const segs = path.split("/").filter(Boolean);
    // /s/{siteSlug} alone is not a page slug
    if (segs.length === 2 && segs[0] === "s") {
      /* keep as-is; unlikely a page ref */
    } else if (segs.length) {
      candidate = segs[segs.length - 1];
    }
  }

  const lower = candidate.toLowerCase();
  const bySlug = pages.find((p) => p.slug.toLowerCase() === lower);
  if (bySlug) return bySlug.slug;

  const byId = pages.find(
    (p) => p.id === candidate || p.id.toLowerCase() === lower
  );
  if (byId) return byId.slug;

  const norm = normalizePageTitleKey(candidate);
  if (norm) {
    const byTitle = pages.find(
      (p) => normalizePageTitleKey(p.title) === norm
    );
    if (byTitle) return byTitle.slug;
  }

  return null;
}

/** Relative / bare paths that look like internal page targets (not mailto/https/#). */
export function looksLikeInternalPagePath(href: string): boolean {
  const h = (href || "").trim();
  if (!h || h === "#") return false;
  if (h.startsWith("#")) return false;
  if (/^(https?:|mailto:|tel:|javascript:)/i.test(h)) return false;
  if (h.startsWith("/s/")) return /[?&]p=/.test(h) ? false : true;
  if (h.startsWith("/")) return true;
  // bare word / slug-like
  return /^[\w\u0600-\u06ff-]+$/i.test(h);
}

function pagesAsRefs(
  pages: Array<{ id: string; slug: string; title: string }>
): PageSlugRef[] {
  return pages.map((p) => ({ id: p.id, slug: p.slug, title: p.title }));
}

function coerceOneNavItem(it: NavItem, pages: PageSlugRef[]): NavItem {
  const slugRaw = (it.linkPageSlug || "").trim();
  const hrefRaw = (it.href || "").trim();
  const linkMode = (it.linkMode || "url").trim() || "url";

  if (linkMode === "page") {
    const resolved =
      resolvePageSlugRef(slugRaw, pages) ||
      resolvePageSlugRef(hrefRaw, pages);
    if (resolved) {
      return { ...it, linkMode: "page", linkPageSlug: resolved, href: "" };
    }
    // Keep but unresolved — verifier will warn
    return { ...it, linkMode: "page", linkPageSlug: slugRaw, href: hrefRaw };
  }

  // url / empty: promote internal href or slug-like targets to page mode
  const resolved =
    resolvePageSlugRef(slugRaw, pages) ||
    (looksLikeInternalPagePath(hrefRaw)
      ? resolvePageSlugRef(hrefRaw, pages)
      : null);
  if (resolved) {
    return { ...it, linkMode: "page", linkPageSlug: resolved, href: "" };
  }
  return it;
}

/**
 * Coerce navbar navItems/links to SiteForge page routing.
 * Accepts full pages (preferred) or legacy string[] of slugs.
 */
export function coerceNavbarLinkProps(
  props: Record<string, unknown>,
  pagesOrSlugs: PageSlugRef[] | string[],
  locales: string[]
): Record<string, unknown> {
  const pages: PageSlugRef[] = Array.isArray(pagesOrSlugs) &&
    pagesOrSlugs.length > 0 &&
    typeof pagesOrSlugs[0] === "string"
    ? (pagesOrSlugs as string[]).map((slug) => ({
        id: slug,
        slug,
        title: slug,
      }))
    : pagesAsRefs(pagesOrSlugs as PageSlugRef[]);
  const out = { ...props };
  const locs = locales.length ? locales : ["ar"];

  // Also coerce navbar CTA fields
  const withCta = coerceBlockLinkFields(out, pages);

  if (Array.isArray(withCta.navItems)) {
    const items = (withCta.navItems as unknown[])
      .map((it, i) => sanitizeNavItem(it, i))
      .filter((x): x is NavItem => !!x)
      .map((it) => coerceOneNavItem(it, pages));
    withCta.navItems = items;
    withCta.links = syncLinksCsvFromNavItems(items, locs);
    return withCta;
  }

  if (withCta.links != null && !Array.isArray(withCta.navItems)) {
    const items = ensureNavItems(withCta, locs).map((it) => {
      const healed = coerceOneNavItem(it, pages);
      if (healed.linkMode === "page" && healed.linkPageSlug) return healed;
      const labelStr =
        typeof it.label === "string"
          ? it.label
          : Object.values(it.label || {})[0] || "";
      const byTitle = pages.find(
        (p) =>
          normalizePageTitleKey(p.title) ===
          normalizePageTitleKey(String(labelStr))
      );
      if (byTitle) {
        return { ...it, linkMode: "page", linkPageSlug: byTitle.slug, href: "" };
      }
      return healed;
    });
    withCta.navItems = items;
    withCta.links = syncLinksCsvFromNavItems(items, locs);
  }
  return withCta;
}

/** Rewrite CTA/button linkMode+slug/href onto SiteForge page routing when possible. */
export function coerceBlockLinkFields(
  props: Record<string, unknown>,
  pages: PageSlugRef[]
): Record<string, unknown> {
  const out = { ...props };
  const mode = typeof out.linkMode === "string" ? out.linkMode : "";
  const slugRaw =
    typeof out.linkPageSlug === "string" ? out.linkPageSlug.trim() : "";
  const hrefKeys = ["href", "ctaHref", "buttonHref"] as const;
  let hrefRaw = "";
  for (const k of hrefKeys) {
    if (typeof out[k] === "string" && (out[k] as string).trim()) {
      hrefRaw = (out[k] as string).trim();
      break;
    }
  }

  const wantsPage =
    mode === "page" ||
    !!slugRaw ||
    looksLikeInternalPagePath(hrefRaw);

  if (!wantsPage) return out;

  const resolved =
    resolvePageSlugRef(slugRaw, pages) ||
    resolvePageSlugRef(hrefRaw, pages);
  if (resolved) {
    out.linkMode = "page";
    out.linkPageSlug = resolved;
    for (const k of hrefKeys) {
      if (k in out) out[k] = "";
    }
  }
  return out;
}

function sanitizePropValue(key: string, value: unknown): unknown {
  if (FORBIDDEN_PROP_KEYS.has(key)) return undefined;
  if (HREF_KEYS.has(key) && typeof value === "string") {
    return normalizeHref(value);
  }
  if (typeof value === "string") {
    return value.replace(/<\/?script/gi, "").slice(0, 8000);
  }
  if (Array.isArray(value)) {
    if (key === "navItems") {
      return value
        .slice(0, 40)
        .map((it, i) => sanitizeNavItem(it, i))
        .filter((x): x is NavItem => !!x);
    }
    return value
      .slice(0, 40)
      .map((item, i) => {
        if (typeof item === "string")
          return item.replace(/<\/?script/gi, "").slice(0, 2000);
        if (item && typeof item === "object" && !Array.isArray(item)) {
          const out: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
            if (FORBIDDEN_PROP_KEYS.has(k)) continue;
            if (typeof v === "string") {
              out[k] = HREF_KEYS.has(k)
                ? normalizeHref(v)
                : v.replace(/<\/?script/gi, "").slice(0, 4000);
            } else if (typeof v === "number" || typeof v === "boolean" || v === null) {
              out[k] = v;
            } else if (v && typeof v === "object" && !Array.isArray(v)) {
              const map: Record<string, string> = {};
              for (const [lk, lv] of Object.entries(v as Record<string, unknown>)) {
                if (typeof lv === "string")
                  map[lk] = lv.replace(/<\/?script/gi, "").slice(0, 4000);
              }
              out[k] = map;
            }
          }
          if (!out.id) out.id = `item-${i}`;
          return out;
        }
        return undefined;
      })
      .filter((x) => x !== undefined);
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_PROP_KEYS.has(k)) continue;
      if (HREF_KEYS.has(k) && typeof v === "string") out[k] = normalizeHref(v);
      else if (typeof v === "string") out[k] = v.replace(/<\/?script/gi, "").slice(0, 8000);
      else if (typeof v === "number" || typeof v === "boolean" || v === null) out[k] = v;
      else if (v && typeof v === "object") {
        const map: Record<string, string> = {};
        for (const [lk, lv] of Object.entries(v as Record<string, unknown>)) {
          if (typeof lv === "string") map[lk] = lv.replace(/<\/?script/gi, "").slice(0, 4000);
        }
        out[k] = map;
      }
    }
    return out;
  }
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  return undefined;
}

function mapBlock(
  content: SiteContent,
  pageId: string,
  blockId: string,
  fn: (block: Block) => Block
): SiteContent {
  return {
    ...content,
    pages: content.pages.map((page) => {
      if (page.id !== pageId) return page;
      return {
        ...page,
        blocks: page.blocks.map((b) => (b.id === blockId ? fn(b) : b)),
      };
    }),
  };
}

function sanitizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function mergeTokens(base: DesignTokens, patch: Record<string, unknown>): DesignTokens {
  const next: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (!ALLOWED_TOKEN_TOP.has(k)) continue;
    if (k === "colors" || k === "colorsDark") {
      if (v && typeof v === "object" && !Array.isArray(v)) {
        const prev = (next[k] as Record<string, string> | undefined) || {};
        const merged: Record<string, string> = { ...prev };
        for (const [ck, cv] of Object.entries(v as Record<string, unknown>)) {
          if (typeof cv === "string" && cv.length <= 64) merged[ck] = cv;
        }
        next[k] = merged;
      }
    } else if (k === "fonts") {
      if (v && typeof v === "object" && !Array.isArray(v)) {
        const prev = (next.fonts as Record<string, string>) || {};
        const merged = { ...prev };
        for (const [fk, fv] of Object.entries(v as Record<string, unknown>)) {
          if (typeof fv === "string" && fv.length <= 120) merged[fk] = fv;
        }
        next.fonts = merged;
      }
    } else if (k === "spacing") {
      if (v && typeof v === "object" && !Array.isArray(v)) {
        const prev = (next.spacing as Record<string, number>) || {};
        const merged = { ...prev };
        for (const [sk, sv] of Object.entries(v as Record<string, unknown>)) {
          const n =
            typeof sv === "number" && Number.isFinite(sv)
              ? sv
              : typeof sv === "string" && sv.trim() && Number.isFinite(Number(sv))
                ? Number(sv)
                : null;
          if (n != null) merged[sk] = n;
        }
        next.spacing = merged;
      }
    } else if (
      k === "radius" &&
      ((typeof v === "number" && Number.isFinite(v)) ||
        (typeof v === "string" && v.trim() && Number.isFinite(Number(v))))
    ) {
      next.radius = Math.max(0, Math.min(48, typeof v === "number" ? v : Number(v)));
    } else if (k === "rtl" && typeof v === "boolean") {
      next.rtl = v;
    } else if (k === "themeMode" && (v === "light" || v === "dark" || v === "system")) {
      next.themeMode = v;
    }
  }
  return designTokensSchema.parse(next);
}


function findBlock(
  content: SiteContent,
  pageId: string,
  blockId: string
): Block | undefined {
  const page = content.pages.find((p) => p.id === pageId);
  return page?.blocks.find((b) => b.id === blockId);
}

function blockPropsSnapshot(
  content: SiteContent,
  pageId: string,
  blockId: string
): string | null {
  const b = findBlock(content, pageId, blockId);
  return b ? JSON.stringify(b.props) : null;
}

function pageSnapshot(content: SiteContent, pageId: string): string | null {
  const p = content.pages.find((x) => x.id === pageId);
  return p ? JSON.stringify(p) : null;
}

function finalizeBlockLinkProps(
  blockType: string,
  props: Record<string, unknown>,
  pages: PageSlugRef[],
  locales: string[]
): Record<string, unknown> {
  let next = props;
  if (
    blockType === "navbar" ||
    "navItems" in props ||
    "links" in props
  ) {
    next = coerceNavbarLinkProps(next, pages, locales);
  } else {
    next = coerceBlockLinkFields(next, pages);
  }
  return next;
}

export function applyAiPatches(
  content: SiteContent,
  patches: AiPatch[]
): { content: SiteContent; applied: number; errors: string[] } {
  let next = structuredClone(content);
  const errors: string[] = [];
  let applied = 0;

  for (const patch of patches) {
    try {
      const parsed = aiPatchSchema.parse(patch);
      const needsPage =
        parsed.op !== "add_page" &&
        parsed.op !== "propose_domain" &&
        parsed.op !== "update_tokens" &&
        parsed.op !== "set_locales" &&
        parsed.op !== "set_default_locale" &&
        parsed.op !== "wire_nav_to_pages";
      const page =
        needsPage && "pageId" in parsed
          ? next.pages.find((p) => p.id === (parsed as { pageId: string }).pageId)
          : undefined;
      if (needsPage && !page) {
        errors.push(`Unknown page ${(parsed as { pageId?: string }).pageId}`);
        continue;
      }

      if (parsed.op === "update_prop") {
        if (!findBlock(next, parsed.pageId, parsed.blockId)) {
          errors.push(`Unknown block ${parsed.blockId}`);
          continue;
        }
        const clean = sanitizePropValue(parsed.key, parsed.value);
        if (clean === undefined) {
          errors.push(`Blocked prop ${parsed.key}`);
          continue;
        }
        const before = blockPropsSnapshot(next, parsed.pageId, parsed.blockId);
        const pageRefs = pagesAsRefs(next.pages);
        const locs = next.locales || ["ar"];
        next = mapBlock(next, parsed.pageId, parsed.blockId, (b) => {
          let props: Record<string, unknown> = { ...b.props, [parsed.key]: clean };
          const linkKeys = new Set([
            "navItems",
            "links",
            "linkMode",
            "linkPageSlug",
            "href",
            "ctaHref",
            "buttonHref",
          ]);
          if (
            b.type === "navbar" ||
            linkKeys.has(parsed.key) ||
            "navItems" in props ||
            "links" in props
          ) {
            props = finalizeBlockLinkProps(b.type, props, pageRefs, locs);
          }
          return { ...b, props };
        });
        const after = blockPropsSnapshot(next, parsed.pageId, parsed.blockId);
        if (before === after) {
          errors.push(`Skipped update_prop on ${parsed.blockId}: no effective change`);
          continue;
        }
        applied += 1;
      } else if (parsed.op === "update_props") {
        const blk = findBlock(next, parsed.pageId, parsed.blockId);
        if (!blk) {
          errors.push(`Unknown block ${parsed.blockId}`);
          continue;
        }
        const before = blockPropsSnapshot(next, parsed.pageId, parsed.blockId);
        const props = { ...(blk.props as Record<string, unknown>) };
        for (const [k, v] of Object.entries(parsed.props)) {
          const clean = sanitizePropValue(k, v);
          if (clean !== undefined) props[k] = clean;
        }
        const pageRefs = pagesAsRefs(next.pages);
        const locs = next.locales || ["ar"];
        const finalProps = finalizeBlockLinkProps(blk.type, props, pageRefs, locs);
        next = mapBlock(next, parsed.pageId, parsed.blockId, (b) => ({
          ...b,
          props: finalProps,
        }));
        const after = blockPropsSnapshot(next, parsed.pageId, parsed.blockId);
        if (before === after) {
          errors.push(`Skipped update_props on ${parsed.blockId}: no effective change`);
          continue;
        }
        applied += 1;
      } else if (parsed.op === "set_part_style") {
        if (!findBlock(next, parsed.pageId, parsed.blockId)) {
          errors.push(`Unknown block ${parsed.blockId}`);
          continue;
        }
        const before = blockPropsSnapshot(next, parsed.pageId, parsed.blockId);
        const styles: PartStyle = {};
        for (const [k, v] of Object.entries(parsed.styles)) {
          if (typeof v === "string") (styles as Record<string, string>)[k] = v.slice(0, 120);
        }
        next = mapBlock(next, parsed.pageId, parsed.blockId, (b) => ({
          ...b,
          props: setPartStyles(b.props as Record<string, unknown>, parsed.part, styles),
        }));
        const after = blockPropsSnapshot(next, parsed.pageId, parsed.blockId);
        if (before === after) {
          errors.push(`Skipped set_part_style on ${parsed.blockId}: no effective change`);
          continue;
        }
        applied += 1;
      } else if (parsed.op === "add_block") {
        const type = parsed.type as BlockType;
        const id =
          parsed.id && /^[a-zA-Z0-9_-]{4,40}$/.test(parsed.id)
            ? parsed.id
            : `ai-${Math.random().toString(36).slice(2, 10)}`;
        let props = { ...defaultPropsFor(type) };
        if (parsed.props) {
          for (const [k, v] of Object.entries(parsed.props)) {
            const clean = sanitizePropValue(k, v);
            if (clean !== undefined) props[k] = clean;
          }
        }
        props = finalizeBlockLinkProps(
          type,
          props,
          pagesAsRefs(next.pages),
          next.locales || ["ar"]
        );
        const block = blockSchema.parse({ id, type, props });
        next = {
          ...next,
          pages: next.pages.map((p) => {
            if (p.id !== parsed.pageId) return p;
            const blocks = [...p.blocks];
            if (parsed.afterBlockId) {
              const idx = blocks.findIndex((b) => b.id === parsed.afterBlockId);
              if (idx >= 0) blocks.splice(idx + 1, 0, block);
              else blocks.push(block);
            } else {
              blocks.push(block);
            }
            return { ...p, blocks };
          }),
        };
        applied += 1;
      } else if (parsed.op === "remove_block") {
        let removed = false;
        next = {
          ...next,
          pages: next.pages.map((p) => {
            if (p.id !== parsed.pageId) return p;
            const blocks = p.blocks.filter((b) => b.id !== parsed.blockId);
            if (blocks.length === p.blocks.length) return p;
            if (blocks.length === 0) {
              errors.push("Cannot remove last block on page");
              return p;
            }
            removed = true;
            return { ...p, blocks };
          }),
        };
        if (removed) applied += 1;
      } else if (parsed.op === "duplicate_block") {
        const src = page!.blocks.find((b) => b.id === parsed.blockId);
        if (!src) {
          errors.push(`Unknown block ${parsed.blockId}`);
          continue;
        }
        const id =
          parsed.id && /^[a-zA-Z0-9_-]{4,40}$/.test(parsed.id)
            ? parsed.id
            : `ai-${Math.random().toString(36).slice(2, 10)}`;
        if (page!.blocks.some((b) => b.id === id)) {
          errors.push(`Block id exists: ${id}`);
          continue;
        }
        const clone = blockSchema.parse({
          id,
          type: src.type,
          props: structuredClone(src.props),
        });
        next = {
          ...next,
          pages: next.pages.map((p) => {
            if (p.id !== parsed.pageId) return p;
            const blocks = [...p.blocks];
            const idx = blocks.findIndex((b) => b.id === parsed.blockId);
            blocks.splice(idx >= 0 ? idx + 1 : blocks.length, 0, clone);
            return { ...p, blocks };
          }),
        };
        applied += 1;
      } else if (parsed.op === "update_copy") {
        if (!findBlock(next, parsed.pageId, parsed.blockId)) {
          errors.push(`Unknown block ${parsed.blockId}`);
          continue;
        }
        const before = blockPropsSnapshot(next, parsed.pageId, parsed.blockId);
        next = mapBlock(next, parsed.pageId, parsed.blockId, (b) => {
          const props = { ...(b.props as Record<string, unknown>) };
          const prev = props[parsed.key];
          const map: Record<string, string> =
            prev && typeof prev === "object" && !Array.isArray(prev)
              ? { ...(prev as Record<string, string>) }
              : typeof prev === "string"
                ? { [parsed.locale]: prev }
                : {};
          map[parsed.locale] = parsed.value.replace(/<\/?script/gi, "").slice(0, 8000);
          props[parsed.key] = map;
          return { ...b, props };
        });
        const after = blockPropsSnapshot(next, parsed.pageId, parsed.blockId);
        if (before === after) {
          errors.push(`Skipped update_copy on ${parsed.blockId}: no effective change`);
          continue;
        }
        applied += 1;
      } else if (parsed.op === "add_page") {
        const slug = sanitizeSlug(parsed.slug);
        if (!slug) {
          errors.push("Invalid page slug");
          continue;
        }
        if (next.pages.some((p) => p.slug === slug)) {
          errors.push(`Slug already used: ${slug}`);
          continue;
        }
        const id =
          parsed.id && /^[a-zA-Z0-9_-]{4,40}$/.test(parsed.id)
            ? parsed.id
            : `page-${Math.random().toString(36).slice(2, 10)}`;
        if (next.pages.some((p) => p.id === id)) {
          errors.push(`Page id exists: ${id}`);
          continue;
        }
        const blankBlock = blockSchema.parse({
          id: `blk-${Math.random().toString(36).slice(2, 10)}`,
          type: "hero",
          props: defaultPropsFor("hero"),
        });
        const newPage = {
          id,
          title: parsed.title.slice(0, 120),
          slug,
          layout: "flow" as const,
          blocks: [blankBlock],
        };
        const pages = [...next.pages];
        if (parsed.afterPageId) {
          const idx = pages.findIndex((p) => p.id === parsed.afterPageId);
          if (idx >= 0) pages.splice(idx + 1, 0, newPage);
          else pages.push(newPage);
        } else {
          pages.push(newPage);
        }
        next = { ...next, pages };
        applied += 1;
      } else if (parsed.op === "remove_page") {
        if (next.pages.length <= 1) {
          errors.push("Cannot remove last page");
          continue;
        }
        if (!next.pages.some((p) => p.id === parsed.pageId)) {
          errors.push(`Unknown page ${parsed.pageId}`);
          continue;
        }
        next = { ...next, pages: next.pages.filter((p) => p.id !== parsed.pageId) };
        applied += 1;
      } else if (parsed.op === "rename_page") {
        const before = pageSnapshot(next, parsed.pageId);
        next = {
          ...next,
          pages: next.pages.map((p) =>
            p.id === parsed.pageId ? { ...p, title: parsed.title.slice(0, 120) } : p
          ),
        };
        const after = pageSnapshot(next, parsed.pageId);
        if (before === after) {
          errors.push(`Skipped rename_page on ${parsed.pageId}: no effective change`);
          continue;
        }
        applied += 1;
      } else if (parsed.op === "set_page_slug") {
        const slug = sanitizeSlug(parsed.slug);
        if (!slug) {
          errors.push("Invalid page slug");
          continue;
        }
        if (next.pages.some((p) => p.slug === slug && p.id !== parsed.pageId)) {
          errors.push(`Slug already used: ${slug}`);
          continue;
        }
        next = {
          ...next,
          pages: next.pages.map((p) => (p.id === parsed.pageId ? { ...p, slug } : p)),
        };
        applied += 1;
      } else if (parsed.op === "set_page_layout") {
        next = {
          ...next,
          pages: next.pages.map((p) =>
            p.id === parsed.pageId ? { ...p, layout: parsed.layout } : p
          ),
        };
        applied += 1;
      } else if (parsed.op === "reorder_blocks") {
        const ids = parsed.blockIds;
        const existing = new Map((page as NonNullable<typeof page>).blocks.map((b) => [b.id, b]));
        const reordered: Block[] = [];
        for (const id of ids) {
          const b = existing.get(id);
          if (b) {
            reordered.push(b);
            existing.delete(id);
          }
        }
        for (const b of existing.values()) reordered.push(b);
        if (reordered.length === 0) {
          errors.push("reorder_blocks produced empty page");
          continue;
        }
        next = {
          ...next,
          pages: next.pages.map((p) =>
            p.id === parsed.pageId ? { ...p, blocks: reordered } : p
          ),
        };
        applied += 1;
      } else if (parsed.op === "set_seo") {
        next = {
          ...next,
          pages: next.pages.map((p) => {
            if (p.id !== parsed.pageId) return p;
            return {
              ...p,
              ...(typeof parsed.seoTitle === "string"
                ? { seoTitle: parsed.seoTitle.slice(0, 200) }
                : {}),
              ...(typeof parsed.seoDescription === "string"
                ? { seoDescription: parsed.seoDescription.slice(0, 500) }
                : {}),
              ...(typeof parsed.seoOgImage === "string"
                ? { seoOgImage: parsed.seoOgImage.slice(0, 500) }
                : {}),
            };
          }),
        };
        applied += 1;
      } else if (parsed.op === "update_tokens") {
        next = {
          ...next,
          tokens: mergeTokens(next.tokens, parsed.tokens),
        };
        applied += 1;
      } else if (parsed.op === "set_locales") {
        const allowed = new Set<string>(LOCALE_CODES);
        const locales = parsed.locales
          .map((l) => l.toLowerCase().slice(0, 12))
          .filter((l) => allowed.has(l) || /^[a-z]{2}(-[a-z]{2})?$/i.test(l));
        const uniq = Array.from(new Set(locales));
        if (!uniq.length) {
          errors.push("No valid locales");
          continue;
        }
        const defaultLocale =
          (parsed.defaultLocale && uniq.includes(parsed.defaultLocale.toLowerCase())
            ? parsed.defaultLocale.toLowerCase()
            : uniq.includes(next.defaultLocale)
              ? next.defaultLocale
              : uniq[0]);
        next = { ...next, locales: uniq, defaultLocale };
        applied += 1;
      } else if (parsed.op === "set_default_locale") {
        const loc = parsed.defaultLocale.toLowerCase();
        if (!next.locales.includes(loc)) {
          errors.push(`Locale not enabled: ${loc}`);
          continue;
        }
        next = { ...next, defaultLocale: loc };
        applied += 1;
      } else if (parsed.op === "set_block_flags") {
        if (!findBlock(next, parsed.pageId, parsed.blockId)) {
          errors.push(`Unknown block ${parsed.blockId}`);
          continue;
        }
        const before = blockPropsSnapshot(next, parsed.pageId, parsed.blockId);
        next = mapBlock(next, parsed.pageId, parsed.blockId, (b) => {
          const props = { ...(b.props as Record<string, unknown>) };
          if (typeof parsed.locked === "boolean") props.locked = parsed.locked;
          if (typeof parsed.hidden === "boolean") props.hidden = parsed.hidden;
          if (parsed.zIndex !== undefined) {
            props.zIndex = String(parsed.zIndex).slice(0, 12);
          }
          if (parsed.stackId === null) {
            delete props.stackId;
            delete props.stackAxis;
            delete props.stackIndex;
            delete props.stackGap;
            delete props.stackAlign;
          } else if (typeof parsed.stackId === "string" && parsed.stackId) {
            props.stackId = parsed.stackId.slice(0, 64);
          }
          return { ...b, props };
        });
        const after = blockPropsSnapshot(next, parsed.pageId, parsed.blockId);
        if (before === after) {
          errors.push(`Skipped set_block_flags on ${parsed.blockId}: no effective change`);
          continue;
        }
        applied += 1;
      } else if (parsed.op === "set_nav_items") {
        const blk = findBlock(next, parsed.pageId, parsed.blockId);
        if (!blk) {
          errors.push(`Unknown block ${parsed.blockId}`);
          continue;
        }
        const pageRefs = pagesAsRefs(next.pages);
        const locs = next.locales?.length ? next.locales : ["ar"];
        const before = blockPropsSnapshot(next, parsed.pageId, parsed.blockId);
        const built: NavItem[] = [];
        for (let i = 0; i < parsed.items.length; i++) {
          const raw = parsed.items[i];
          const label = raw.label;
          const modeHint = (raw.linkMode || "").trim();
          const slugRaw = (raw.linkPageSlug || "").trim();
          const hrefRaw = (raw.href || "").trim();
          let linkMode = modeHint || (slugRaw ? "page" : hrefRaw ? "url" : "page");
          let linkPageSlug = "";
          let href = "";
          if (linkMode === "page" || (!modeHint && (slugRaw || looksLikeInternalPagePath(hrefRaw)))) {
            const resolved =
              resolvePageSlugRef(slugRaw, pageRefs) ||
              resolvePageSlugRef(hrefRaw, pageRefs);
            if (resolved) {
              linkMode = "page";
              linkPageSlug = resolved;
              href = "";
            } else {
              linkMode = "page";
              linkPageSlug = slugRaw;
              href = hrefRaw;
            }
          } else if (linkMode === "collection") {
            linkPageSlug = "";
            href = hrefRaw ? normalizeHref(hrefRaw) : "";
          } else {
            linkMode = "url";
            href = hrefRaw ? normalizeHref(hrefRaw) : "";
            const promoted = looksLikeInternalPagePath(href)
              ? resolvePageSlugRef(href, pageRefs)
              : null;
            if (promoted) {
              linkMode = "page";
              linkPageSlug = promoted;
              href = "";
            }
          }
          const nav: NavItem = {
            id:
              typeof raw.id === "string" && raw.id
                ? raw.id.slice(0, 64)
                : `nav-${i}`,
            label:
              typeof label === "string" || (label && typeof label === "object")
                ? (label as NavItem["label"])
                : `Link ${i + 1}`,
            href,
            linkMode,
            linkPageSlug,
            actionType: "link",
          };
          built.push(nav);
        }
        next = mapBlock(next, parsed.pageId, parsed.blockId, (b) => {
          const props = {
            ...(b.props as Record<string, unknown>),
            navItems: built,
            links: syncLinksCsvFromNavItems(built, locs),
          };
          return {
            ...b,
            props: finalizeBlockLinkProps(b.type, props, pageRefs, locs),
          };
        });
        const after = blockPropsSnapshot(next, parsed.pageId, parsed.blockId);
        if (before === after) {
          errors.push(`Skipped set_nav_items on ${parsed.blockId}: no effective change`);
          continue;
        }
        applied += 1;
      } else if (parsed.op === "wire_nav_to_pages") {
        if (parsed.pageId) {
          if (!next.pages.some((p) => p.id === parsed.pageId)) {
            errors.push(`Unknown page ${parsed.pageId}`);
            continue;
          }
        }
        const before = JSON.stringify(next);
        next = syncAllNavbarsToPages(next, parsed.pageId);
        if (before === JSON.stringify(next)) {
          errors.push("Skipped wire_nav_to_pages: no effective change");
          continue;
        }
        applied += 1;
      } else if (parsed.op === "set_button_link") {
        const blk = findBlock(next, parsed.pageId, parsed.blockId);
        if (!blk) {
          errors.push(`Unknown block ${parsed.blockId}`);
          continue;
        }
        const pageRefs = pagesAsRefs(next.pages);
        const before = blockPropsSnapshot(next, parsed.pageId, parsed.blockId);
        const hrefKey = parsed.key || "ctaHref";
        next = mapBlock(next, parsed.pageId, parsed.blockId, (b) => {
          const props: Record<string, unknown> = {
            ...(b.props as Record<string, unknown>),
          };
          const mode = parsed.linkMode;
          const slug = (parsed.linkPageSlug || "").trim();
          const href = (parsed.href || "").trim();
          if (mode === "page") {
            const resolved =
              resolvePageSlugRef(slug, pageRefs) ||
              resolvePageSlugRef(href, pageRefs);
            if (resolved) {
              props.linkMode = "page";
              props.linkPageSlug = resolved;
              props[hrefKey] = "";
              if ("href" in props && hrefKey !== "href") props.href = props.href || "";
              if ("ctaHref" in props && hrefKey !== "ctaHref") props.ctaHref = "";
              if ("buttonHref" in props && hrefKey !== "buttonHref") props.buttonHref = "";
            } else {
              props.linkMode = "page";
              props.linkPageSlug = slug;
              props[hrefKey] = href ? normalizeHref(href) : "";
            }
          } else if (mode === "collection") {
            props.linkMode = "collection";
            props.linkPageSlug = "";
            if (parsed.linkCollectionSlug) {
              props.linkCollectionSlug = parsed.linkCollectionSlug.slice(0, 80);
            }
            props[hrefKey] = href ? normalizeHref(href) : "";
          } else {
            // url — promote internal paths
            const promoted = looksLikeInternalPagePath(href)
              ? resolvePageSlugRef(href, pageRefs)
              : null;
            if (promoted) {
              props.linkMode = "page";
              props.linkPageSlug = promoted;
              props[hrefKey] = "";
            } else {
              props.linkMode = "url";
              props.linkPageSlug = "";
              props[hrefKey] = href ? normalizeHref(href) : "";
            }
          }
          return {
            ...b,
            props: coerceBlockLinkFields(props, pageRefs),
          };
        });
        const after = blockPropsSnapshot(next, parsed.pageId, parsed.blockId);
        if (before === after) {
          errors.push(`Skipped set_button_link on ${parsed.blockId}: no effective change`);
          continue;
        }
        applied += 1;
      } else if (parsed.op === "propose_domain") {
        const domain = parsed.domain
          .trim()
          .toLowerCase()
          .replace(/^https?:\/\//, "")
          .split("/")[0]
          .slice(0, 255);
        if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) {
          errors.push("Invalid domain suggestion");
          continue;
        }
        next = {
          ...next,
          meta: {
            ...(next.meta || {}),
            domainProposal: domain,
          },
        };
        applied += 1;
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "Invalid patch");
    }
  }

  try {
    next = siteContentSchema.parse(next);
  } catch (e) {
    errors.push(e instanceof Error ? e.message : "Content failed schema validation");
    return { content, applied: 0, errors };
  }

  return { content: next, applied, errors };
}

export type LinkVerifyIssue = {
  pageId: string;
  blockId: string;
  detail: string;
};

export type LinkVerifyResult = { ok: boolean; issues: LinkVerifyIssue[] };

/** Post-apply: every page-mode link must resolve; flag unwired internal URLs. */
export function verifySiteContentLinks(content: SiteContent): LinkVerifyResult {
  const issues: LinkVerifyIssue[] = [];
  const slugSet = new Set(content.pages.map((p) => p.slug.toLowerCase()));
  const refs = pagesAsRefs(content.pages);

  const checkPageMode = (
    pageId: string,
    blockId: string,
    label: string,
    slug: string
  ) => {
    const s = (slug || "").trim();
    if (!s || !slugSet.has(s.toLowerCase())) {
      issues.push({
        pageId,
        blockId,
        detail: `${label} linkPageSlug "${s || "(empty)"}" not in pages`,
      });
    }
  };

  const checkUrlHref = (
    pageId: string,
    blockId: string,
    label: string,
    href: string
  ) => {
    const h = (href || "").trim();
    if (!looksLikeInternalPagePath(h)) return;
    const resolved = resolvePageSlugRef(h, refs);
    issues.push({
      pageId,
      blockId,
      detail: resolved
        ? `${label} href "${h}" should use linkMode page + slug "${resolved}"`
        : `${label} href "${h}" looks internal but no matching page`,
    });
  };

  for (const page of content.pages) {
    for (const block of page.blocks) {
      const props = block.props as Record<string, unknown>;

      if (Array.isArray(props.navItems)) {
        for (const raw of props.navItems as NavItem[]) {
          const it = raw;
          const label = `navItem "${it.id || "?"}"`;
          const mode = (it.linkMode || "url").trim() || "url";
          if (mode === "page") {
            checkPageMode(page.id, block.id, label, it.linkPageSlug || "");
          } else {
            checkUrlHref(page.id, block.id, label, it.href || "");
          }
        }
      }

      const mode = typeof props.linkMode === "string" ? props.linkMode : "";
      if (mode === "page") {
        checkPageMode(
          page.id,
          block.id,
          `block ${block.type}`,
          typeof props.linkPageSlug === "string" ? props.linkPageSlug : ""
        );
      }
      for (const key of ["href", "ctaHref", "buttonHref"] as const) {
        if (typeof props[key] === "string") {
          // When already page mode with good slug, empty href is fine
          if (mode === "page") continue;
          checkUrlHref(page.id, block.id, key, props[key] as string);
        }
      }
    }
  }

  return { ok: issues.length === 0, issues };
}

function navItemLabelText(it: NavItem): string {
  if (typeof it.label === "string") return it.label;
  if (it.label && typeof it.label === "object") {
    return Object.values(it.label).filter(Boolean).join(" ");
  }
  return "";
}

/**
 * Conservative navbar sync across all pages:
 * - coerce/heal existing navItems with bad slugs when a page matches
 * - ensure one navItem per page (match by label/title first; append missing non-home sparingly)
 */
export function syncAllNavbarsToPages(
  content: SiteContent,
  pageId?: string
): SiteContent {
  const refs = pagesAsRefs(content.pages);
  const locs = content.locales?.length ? content.locales : ["ar"];

  return {
    ...content,
    pages: content.pages.map((page) => {
      if (pageId && page.id !== pageId) return page;
      return {
      ...page,
      blocks: page.blocks.map((block) => {
        if (block.type !== "navbar") return block;
        let props = coerceNavbarLinkProps(
          { ...(block.props as Record<string, unknown>) },
          refs,
          locs
        );
        const items: NavItem[] = Array.isArray(props.navItems)
          ? [...(props.navItems as NavItem[])]
          : [];

        // Heal existing items against all pages
        for (let i = 0; i < items.length; i++) {
          items[i] = coerceOneNavItem(items[i], refs);
          // Match by label → page title when still unresolved
          if (
            items[i].linkMode === "page" &&
            items[i].linkPageSlug &&
            !refs.some(
              (p) =>
                p.slug.toLowerCase() ===
                (items[i].linkPageSlug || "").toLowerCase()
            )
          ) {
            const byLabel = refs.find(
              (p) =>
                normalizePageTitleKey(p.title) ===
                normalizePageTitleKey(navItemLabelText(items[i]))
            );
            if (byLabel) {
              items[i] = {
                ...items[i],
                linkMode: "page",
                linkPageSlug: byLabel.slug,
                href: "",
              };
            }
          }
        }

        // Ensure each page has a matching nav item (prefer label match; else append)
        for (const p of refs) {
          const has = items.some((it) => {
            if (
              it.linkMode === "page" &&
              (it.linkPageSlug || "").toLowerCase() === p.slug.toLowerCase()
            ) {
              return true;
            }
            return (
              normalizePageTitleKey(navItemLabelText(it)) ===
              normalizePageTitleKey(p.title)
            );
          });
          if (has) {
            // Fix label-matched item to correct slug
            for (let i = 0; i < items.length; i++) {
              if (
                normalizePageTitleKey(navItemLabelText(items[i])) ===
                  normalizePageTitleKey(p.title) &&
                (items[i].linkPageSlug || "").toLowerCase() !== p.slug.toLowerCase()
              ) {
                items[i] = {
                  ...items[i],
                  linkMode: "page",
                  linkPageSlug: p.slug,
                  href: "",
                };
              }
            }
            continue;
          }
          // Append missing (skip inventing home if already many url stubs — still add for real pages)
          const labelMap: Record<string, string> = {};
          for (const loc of locs) labelMap[loc] = p.title;
          items.push({
            id: `nav-${p.slug}`.slice(0, 64),
            label: labelMap,
            linkMode: "page",
            linkPageSlug: p.slug,
            href: "",
            actionType: "link",
          });
        }

        props = {
          ...props,
          navItems: items,
          links: syncLinksCsvFromNavItems(items, locs),
        };
        return { ...block, props };
      }),
    };
    }),
  };
}

/** True when user asked about pages/nav/links or patches added a page. */
export function shouldAutoHealNavbars(
  userMessage: string,
  patches: AiPatch[]
): boolean {
  if (
    patches.some(
      (p) =>
        p.op === "add_page" ||
        p.op === "set_nav_items" ||
        p.op === "wire_nav_to_pages" ||
        p.op === "set_button_link"
    )
  ) {
    return true;
  }
  if (
    patches.some(
      (p) =>
        (p.op === "update_prop" || p.op === "update_props") &&
        (("key" in p &&
          (p.key === "navItems" ||
            p.key === "links" ||
            p.key === "linkMode" ||
            p.key === "linkPageSlug")) ||
          ("props" in p &&
            p.props &&
            ("navItems" in p.props ||
              "links" in p.props ||
              "linkMode" in p.props ||
              "linkPageSlug" in p.props)))
    )
  ) {
    return true;
  }
  const m = (userMessage || "").toLowerCase();
  return /صفحات|صفحة|روابط|رابط|هيدر|قائمة|تنقل|تنقّل|نافبار|navbar|nav\b|header|menu|links?|pages?|404|slug/.test(
    m
  );
}

/** Intent classes for a lightweight focus hint (token-tight). */
export type AiIntentClass =
  | "nav_pages"
  | "design_tokens"
  | "copy_i18n"
  | "layout_blocks"
  | "seo"
  | "media";

/** Detect coarse intent from user message (ar/en). Order is stable for hints. */
export function detectAiIntentClasses(message: string): AiIntentClass[] {
  const m = (message || "").toLowerCase();
  const out: AiIntentClass[] = [];
  const add = (c: AiIntentClass) => {
    if (!out.includes(c)) out.push(c);
  };
  if (
    /صفحات|صفحة|روابط|رابط|هيدر|قائمة|تنقل|تنقّل|نافبار|navbar|nav\b|header|menu|links?|pages?|404|slug|cta\b|زر/.test(
      m
    )
  ) {
    add("nav_pages");
  }
  if (
    /تصميم|ألوان|لون|ثيم|خط|خطوط|radius|theme|token|design|color|font|spacing|dark|light|تركواز|teal/.test(
      m
    )
  ) {
    add("design_tokens");
  }
  if (
    /ترجم|نص|نصوص|لغة|لغات|locale|i18n|copy|translate|headline|عنوان|وصف|كتابة/.test(
      m
    )
  ) {
    add("copy_i18n");
  }
  if (
    /قسم|أقسام|كتلة|كتل|block|section|layout|canvas|reorder|ترتيب|أضف|احذف|duplicate|كرّر/.test(
      m
    )
  ) {
    add("layout_blocks");
  }
  if (/seo|meta|og\b|محركات|بحث|seoTitle|description/.test(m)) {
    add("seo");
  }
  if (/صورة|صور|فيديو|media|image|video|gallery|مرفق|attachment/.test(m)) {
    add("media");
  }
  return out;
}

/** 4–8 line focus hint injected into the user payload (not a second system prompt). */
export function buildIntentFocusHint(classes: AiIntentClass[]): string {
  if (!classes.length) {
    return "Focus: prefer few precise patches; use real pageId/blockId from index; verify linkMode page + slug.";
  }
  const lines: string[] = ["Focus:"];
  if (classes.includes("nav_pages")) {
    lines.push(
      "- Wire ALL navbars with set_nav_items and/or wire_nav_to_pages; linkMode page + real slug (not id/title/href)."
    );
    lines.push("- After add_page: set_nav_items or wire_nav_to_pages on every navbar.");
  }
  if (classes.includes("design_tokens")) {
    lines.push(
      "- Prefer update_tokens (+ set_part_style); styles values must be strings."
    );
  }
  if (classes.includes("copy_i18n")) {
    lines.push(
      "- Prefer update_copy per locale; cover all content.locales when translating."
    );
  }
  if (classes.includes("layout_blocks")) {
    lines.push(
      "- Use add_block/remove_block/reorder_blocks/duplicate_block with real ids from index."
    );
  }
  if (classes.includes("seo")) {
    lines.push("- Use set_seo on the target pageId.");
  }
  if (classes.includes("media")) {
    lines.push("- Prefer attachment/media URLs from context; never invent hosts.");
  }
  return lines.slice(0, 8).join("\n");
}

/** Slim draft index for semantic repair prompts (token-cheap). */
export function buildCompactRepairIndex(content: SiteContent): {
  pages: Array<{ id: string; slug: string; title: string }>;
  navbars: Array<{
    pageId: string;
    blockId: string;
    items: Array<{
      id: string;
      linkMode?: string;
      linkPageSlug?: string;
      href?: string;
    }>;
  }>;
  ctas: Array<{
    pageId: string;
    blockId: string;
    type: string;
    linkMode?: string;
    linkPageSlug?: string;
    href?: string;
  }>;
} {
  const pages = content.pages.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
  }));
  const navbars: Array<{
    pageId: string;
    blockId: string;
    items: Array<{
      id: string;
      linkMode?: string;
      linkPageSlug?: string;
      href?: string;
    }>;
  }> = [];
  const ctas: Array<{
    pageId: string;
    blockId: string;
    type: string;
    linkMode?: string;
    linkPageSlug?: string;
    href?: string;
  }> = [];
  for (const p of content.pages) {
    for (const b of p.blocks) {
      const props = b.props as Record<string, unknown>;
      if (b.type === "navbar") {
        const items = Array.isArray(props.navItems)
          ? (props.navItems as NavItem[]).slice(0, 24).map((it) => ({
              id: it.id || "?",
              linkMode: it.linkMode,
              linkPageSlug: it.linkPageSlug,
              href: it.href,
            }))
          : [];
        navbars.push({ pageId: p.id, blockId: b.id, items });
      }
      if (b.type === "hero" || b.type === "cta" || b.type === "button") {
        const href =
          (typeof props.ctaHref === "string" && props.ctaHref) ||
          (typeof props.href === "string" && props.href) ||
          (typeof props.buttonHref === "string" && props.buttonHref) ||
          "";
        ctas.push({
          pageId: p.id,
          blockId: b.id,
          type: b.type,
          linkMode: typeof props.linkMode === "string" ? props.linkMode : undefined,
          linkPageSlug:
            typeof props.linkPageSlug === "string" ? props.linkPageSlug : undefined,
          href: href || undefined,
        });
      }
    }
  }
  return { pages, navbars: navbars.slice(0, 20), ctas: ctas.slice(0, 20) };
}

/**
 * Deterministic healers before any semantic model repair:
 * sync navbars + coerce CTA/button/hero link fields.
 */
export function runDeterministicLinkHeal(
  content: SiteContent,
  pageId?: string
): SiteContent {
  let next = syncAllNavbarsToPages(content, pageId);
  const refs = pagesAsRefs(next.pages);
  next = {
    ...next,
    pages: next.pages.map((page) => {
      if (pageId && page.id !== pageId) return page;
      return {
        ...page,
        blocks: page.blocks.map((block) => {
          if (block.type === "navbar") return block;
          if (
            block.type !== "hero" &&
            block.type !== "cta" &&
            block.type !== "button" &&
            block.type !== "footer"
          ) {
            return block;
          }
          const props = coerceBlockLinkFields(
            { ...(block.props as Record<string, unknown>) },
            refs
          );
          // Footer column/list link-ish objects
          if (block.type === "footer") {
            for (const key of ["columns", "links", "items"] as const) {
              if (!Array.isArray(props[key])) continue;
              props[key] = (props[key] as unknown[]).map((item) => {
                if (!item || typeof item !== "object" || Array.isArray(item)) {
                  return item;
                }
                return coerceBlockLinkFields(
                  { ...(item as Record<string, unknown>) },
                  refs
                );
              });
            }
          }
          return { ...block, props };
        }),
      };
    }),
  };
  return next;
}

/** When to run the self-check repair pass (deterministic ± one model call). */
export function shouldRunSemanticRepair(opts: {
  userMessage: string;
  issues: LinkVerifyIssue[];
  applied: number;
  patchCount: number;
}): boolean {
  if (opts.issues.length > 0) return true;
  const classes = detectAiIntentClasses(opts.userMessage);
  const structural = classes.some(
    (c) =>
      c === "nav_pages" || c === "design_tokens" || c === "layout_blocks"
  );
  if (structural && opts.patchCount > 0 && opts.applied < opts.patchCount) {
    return true;
  }
  return false;
}

/** Semantic repair prompt: failed issues + compact index (not vague prose). */
export function buildSemanticRepairUserPrompt(opts: {
  issues: LinkVerifyIssue[];
  index: ReturnType<typeof buildCompactRepairIndex>;
  userMessage: string;
  appliedPartial?: boolean;
}): string {
  const issueLines = opts.issues
    .slice(0, 16)
    .map((i) => `- ${i.pageId}/${i.blockId}: ${i.detail}`)
    .join("\n");
  return `SiteForge semantic link/nav repair. Return ONLY {"summary":"...","patches":[...]} — allowlisted ops.
Prefer set_nav_items, wire_nav_to_pages, set_button_link (then update_props if needed).
Fix EVERY listed issue. Use real pageId/blockId/slug from the index. Max 24 patches. No markdown.

User goal (context):
${(opts.userMessage || "").slice(0, 800)}

Failed verifier issues:
${issueLines || "(none — repair partial apply / missing nav wire)"}
${opts.appliedPartial ? "\nApply was partial — finish wiring nav/pages/design.\n" : ""}
Current draft index (compact JSON):
${JSON.stringify(opts.index).slice(0, 8000)}
`;
}

/** Rewrite model summary when verifier finds broken links — never trust «nav fixed» claims. */
export function buildHonestApplySummary(opts: {
  modelSummary?: string;
  applied: number;
  errors: string[];
  issues: LinkVerifyIssue[];
  healed?: boolean;
  platformLang: "ar" | "en";
}): string {
  const { modelSummary, applied, issues, healed, platformLang } = opts;
  const ar = platformLang === "ar";
  const issueBits = issues
    .slice(0, 4)
    .map((i) => i.detail)
    .join("; ");

  if (applied === 0 && !healed) {
    return (
      modelSummary && !/fixed|تم إصلاح|أصلحت|all links/i.test(modelSummary)
        ? modelSummary
        : undefined
    ) || (ar
      ? "لم يُطبَّق أي تعديل فعّال — تحقق من معرّفات الكتل والروابط."
      : "No effective edits applied — check block ids and links.");
  }

  if (issues.length === 0) {
    const base =
      modelSummary?.trim() ||
      (ar ? `تم تطبيق ${applied} تعديلاً.` : `Applied ${applied} change(s).`);
    if (healed) {
      return ar
        ? `${base} (تمت مزامنة شريط التنقل مع الصفحات)`
        : `${base} (navbars synced to pages)`;
    }
    return base.slice(0, 500);
  }

  // Issues remain — never echo unverified «fixed nav» claims
  if (ar) {
    return (
      `طُبّق ${applied} تعديلاً` +
      (healed ? " مع إصلاح تلقائي للقائمة" : "") +
      `، لكن ما زالت مشاكل في الروابط: ${issueBits}. ` +
      `لا يُعتمد ادعاء النموذج بأن التنقل أُصلح بالكامل.`
    ).slice(0, 500);
  }
  return (
    `Applied ${applied} change(s)` +
    (healed ? " with navbar auto-heal" : "") +
    `, but link issues remain: ${issueBits}. ` +
    `Model claim that nav is fully fixed is not verified.`
  ).slice(0, 500);
}

/** Light trailing-comma cleanup safe for model JSON (objects/arrays only). */
export function stripTrailingCommas(jsonLike: string): string {
  return jsonLike.replace(/,\s*([\]}])/g, "$1");
}

function tryParseJson(raw: string): unknown | null {
  const candidates = [raw, stripTrailingCommas(raw)];
  for (const c of candidates) {
    try {
      return JSON.parse(c);
    } catch {
      /* try next */
    }
  }
  return null;
}

/** Extract first balanced JSON object or array from text. */
function extractBalanced(text: string, openCh: "{" | "["): string | null {
  const closeCh = openCh === "{" ? "}" : "]";
  const start = text.indexOf(openCh);
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      continue;
    }
    if (ch === openCh) depth += 1;
    else if (ch === closeCh) {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * Harden model output → JSON value.
 * Strips ```json fences, tolerates light trailing commas, prefers object then array.
 */
export function extractJsonObject(text: string): unknown | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  const candidate = (fence ? fence[1] : trimmed).trim();

  const direct = tryParseJson(candidate);
  if (direct !== null) return direct;

  const obj = extractBalanced(candidate, "{");
  if (obj) {
    const parsed = tryParseJson(obj);
    if (parsed !== null) return parsed;
  }
  const arr = extractBalanced(candidate, "[");
  if (arr) {
    const parsed = tryParseJson(arr);
    if (parsed !== null) return parsed;
  }
  return null;
}

const KNOWN_OPS = new Set([
  "update_prop",
  "update_props",
  "set_part_style",
  "add_block",
  "remove_block",
  "duplicate_block",
  "update_copy",
  "add_page",
  "remove_page",
  "rename_page",
  "set_page_slug",
  "set_page_layout",
  "reorder_blocks",
  "set_seo",
  "update_tokens",
  "set_locales",
  "set_default_locale",
  "set_block_flags",
  "propose_domain",
  "set_nav_items",
  "wire_nav_to_pages",
  "set_button_link",
]);

/** Map common model aliases → allowlisted ops. */
function normalizeOpName(op: unknown): string | null {
  if (typeof op !== "string") return null;
  const raw = op.trim();
  const lower = raw.toLowerCase().replace(/[\s-]+/g, "_");
  const aliases: Record<string, string> = {
    updateprop: "update_prop",
    update_property: "update_prop",
    set_prop: "update_prop",
    set_props: "update_props",
    updateprops: "update_props",
    patch_props: "update_props",
    style_part: "set_part_style",
    set_style: "set_part_style",
    part_style: "set_part_style",
    setpartstyle: "set_part_style",
    addblock: "add_block",
    insert_block: "add_block",
    removeblock: "remove_block",
    delete_block: "remove_block",
    duplicateblock: "duplicate_block",
    copy_block: "duplicate_block",
    updatecopy: "update_copy",
    set_copy: "update_copy",
    set_text: "update_copy",
    translate: "update_copy",
    addpage: "add_page",
    create_page: "add_page",
    removepage: "remove_page",
    delete_page: "remove_page",
    renamepage: "rename_page",
    setpageslug: "set_page_slug",
    set_slug: "set_page_slug",
    setpagelayout: "set_page_layout",
    set_layout: "set_page_layout",
    reorderblocks: "reorder_blocks",
    reorder: "reorder_blocks",
    setseo: "set_seo",
    seo: "set_seo",
    updatetokens: "update_tokens",
    set_tokens: "update_tokens",
    update_token: "update_tokens",
    design_tokens: "update_tokens",
    improve_design: "update_tokens",
    setlocales: "set_locales",
    add_locale: "set_locales",
    enable_locales: "set_locales",
    setdefaultlocale: "set_default_locale",
    setblockflags: "set_block_flags",
    set_flags: "set_block_flags",
    proposedomain: "propose_domain",
    suggest_domain: "propose_domain",
    set_nav_items: "set_nav_items",
    set_nav: "set_nav_items",
    set_navbar_items: "set_nav_items",
    update_nav: "set_nav_items",
    update_nav_items: "set_nav_items",
    setnavitems: "set_nav_items",
    wire_nav_to_pages: "wire_nav_to_pages",
    wire_nav: "wire_nav_to_pages",
    sync_nav: "wire_nav_to_pages",
    sync_navbars: "wire_nav_to_pages",
    sync_navbar: "wire_nav_to_pages",
    wirenavtopages: "wire_nav_to_pages",
    set_button_link: "set_button_link",
    set_cta_link: "set_button_link",
    set_link: "set_button_link",
    wire_button: "set_button_link",
    wire_cta: "set_button_link",
    setbuttonlink: "set_button_link",
  };
  if (KNOWN_OPS.has(lower)) return lower;
  if (aliases[lower]) return aliases[lower];
  if (aliases[raw]) return aliases[raw];
  return KNOWN_OPS.has(raw) ? raw : null;
}

/** Coerce style map values to strings (models often emit numbers). */
export function coerceStyleValues(styles: unknown): Record<string, string> | null {
  if (!styles || typeof styles !== "object" || Array.isArray(styles)) return null;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(styles as Record<string, unknown>)) {
    if (typeof v === "string") out[k] = v.slice(0, 120);
    else if (typeof v === "number" && Number.isFinite(v)) out[k] = String(v);
    else if (typeof v === "boolean") out[k] = v ? "true" : "false";
  }
  return Object.keys(out).length ? out : null;
}

function coerceTokenBag(tokens: unknown): Record<string, unknown> | null {
  if (!tokens || typeof tokens !== "object" || Array.isArray(tokens)) return null;
  const t = { ...(tokens as Record<string, unknown>) };
  if (typeof t.radius === "string" && t.radius.trim() && Number.isFinite(Number(t.radius))) {
    t.radius = Number(t.radius);
  }
  if (t.spacing && typeof t.spacing === "object" && !Array.isArray(t.spacing)) {
    const sp: Record<string, unknown> = {};
    for (const [sk, sv] of Object.entries(t.spacing as Record<string, unknown>)) {
      if (typeof sv === "number" && Number.isFinite(sv)) sp[sk] = sv;
      else if (typeof sv === "string" && sv.trim() && Number.isFinite(Number(sv))) sp[sk] = Number(sv);
    }
    t.spacing = sp;
  }
  return t;
}

function coercePatch(raw: unknown): unknown | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const p = { ...(raw as Record<string, unknown>) };
  // Salvage root colors/fonts into update_tokens when op missing
  let op = normalizeOpName(p.op ?? p.operation ?? p.type ?? p.action);
  if (
    !op &&
    (p.colors || p.fonts || p.colorsDark || p.spacing || p.radius != null || p.tokens)
  ) {
    op = "update_tokens";
  }
  if (!op) return null;
  p.op = op;
  delete p.operation;
  delete p.type;
  delete p.action;

  // Common shape mistakes
  if (op === "update_tokens") {
    if (!p.tokens && p.value && typeof p.value === "object") p.tokens = p.value;
    if (!p.tokens || typeof p.tokens !== "object" || Array.isArray(p.tokens)) {
      const tokens: Record<string, unknown> = {};
      if (p.colors) tokens.colors = p.colors;
      if (p.colorsDark) tokens.colorsDark = p.colorsDark;
      if (p.fonts) tokens.fonts = p.fonts;
      if (p.spacing) tokens.spacing = p.spacing;
      if (p.radius != null) tokens.radius = p.radius;
      if (p.rtl != null) tokens.rtl = p.rtl;
      if (p.themeMode != null) tokens.themeMode = p.themeMode;
      if (Object.keys(tokens).length) p.tokens = tokens;
    } else {
      // Merge root aliases into tokens
      const tokens = { ...(p.tokens as Record<string, unknown>) };
      if (p.colors && !tokens.colors) tokens.colors = p.colors;
      if (p.fonts && !tokens.fonts) tokens.fonts = p.fonts;
      p.tokens = tokens;
    }
    const coerced = coerceTokenBag(p.tokens);
    if (coerced) p.tokens = coerced;
  }
  if (op === "set_part_style") {
    if (!p.styles && p.style && typeof p.style === "object") p.styles = p.style;
    if (!p.styles && p.props && typeof p.props === "object") p.styles = p.props;
    if (!p.styles && p.css && typeof p.css === "object") p.styles = p.css;
    const styles = coerceStyleValues(p.styles);
    if (styles) p.styles = styles;
  }
  if (op === "update_props" && !p.props && p.changes && typeof p.changes === "object") {
    p.props = p.changes;
  }
  if (op === "update_copy" && typeof p.text === "string" && p.value == null) {
    p.value = p.text;
  }
  if (op === "set_locales" && Array.isArray(p.locale) && !p.locales) {
    p.locales = p.locale;
  }
  if (op === "set_nav_items") {
    if (!p.items && Array.isArray(p.navItems)) p.items = p.navItems;
    if (!p.items && Array.isArray(p.links)) p.items = p.links;
    if (!p.items && p.props && typeof p.props === "object" && !Array.isArray(p.props)) {
      const props = p.props as Record<string, unknown>;
      if (Array.isArray(props.navItems)) p.items = props.navItems;
    }
  }
  if (op === "set_button_link") {
    if (!p.linkMode && typeof p.mode === "string") p.linkMode = p.mode;
    if (!p.href && typeof p.url === "string") p.href = p.url;
    if (!p.linkPageSlug && typeof p.slug === "string") p.linkPageSlug = p.slug;
    if (!p.key && typeof p.hrefKey === "string") p.key = p.hrefKey;
  }
  // Close-shape: update_props with only navItems → set_nav_items
  if (
    op === "update_props" &&
    p.props &&
    typeof p.props === "object" &&
    !Array.isArray(p.props)
  ) {
    const props = p.props as Record<string, unknown>;
    const keys = Object.keys(props);
    if (
      keys.length === 1 &&
      keys[0] === "navItems" &&
      Array.isArray(props.navItems) &&
      typeof p.pageId === "string" &&
      typeof p.blockId === "string"
    ) {
      p.op = "set_nav_items";
      p.items = props.navItems;
      delete p.props;
    }
  }
  return p;
}

/**
 * Deterministic repair: coerce bare arrays, alias ops, drop invalid entries.
 * Soft-fail: keep every patch that coerces; return summary-only when useful.
 * Returns null only when nothing salvageable (no summary and 0 valid patches).
 */
export function repairAiPatchesResponse(raw: unknown): AiPatchesResponse | null {
  if (raw == null) return null;

  let summary: string | undefined;
  let list: unknown[] = [];
  let hadPatchArray = false;

  if (Array.isArray(raw)) {
    list = raw;
    hadPatchArray = true;
  } else if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.summary === "string") summary = obj.summary.slice(0, 500);
    if (Array.isArray(obj.patches)) {
      list = obj.patches;
      hadPatchArray = true;
    } else if (Array.isArray(obj.edits)) {
      list = obj.edits;
      hadPatchArray = true;
    } else if (Array.isArray(obj.changes)) {
      list = obj.changes;
      hadPatchArray = true;
    } else if (Array.isArray(obj.operations)) {
      list = obj.operations;
      hadPatchArray = true;
    } else if (obj.patch && typeof obj.patch === "object") list = [obj.patch];
    else if (typeof obj.op === "string" || obj.operation || obj.action) list = [obj];
    else if (obj.colors || obj.fonts || obj.tokens) list = [obj];
  } else {
    return null;
  }

  const patches: AiPatch[] = [];
  const dropNotes: string[] = [];
  for (const item of list.slice(0, 24)) {
    const coerced = coercePatch(item);
    if (!coerced) {
      dropNotes.push("unrecognized op");
      continue;
    }
    const parsed = aiPatchSchema.safeParse(coerced);
    if (parsed.success) patches.push(parsed.data);
    else {
      const issue = parsed.error.issues[0];
      dropNotes.push(
        issue
          ? `${issue.path.join(".") || "patch"}: ${issue.message}`
          : "zod fail"
      );
    }
  }

  // Soft-fail: patches array present but all invalid → still return empty+summary
  // so callers can soft-error instead of hard "invalid patches".
  if (!patches.length && !summary) {
    if (hadPatchArray) {
      return {
        summary:
          "No valid patches after coerce. Styles values must be strings (e.g. paddingX:\"24\"). / لا توجد تعديلات صالحة — قيم styles يجب أن تكون نصوصاً.",
        patches: [],
      };
    }
    return null;
  }
  if (!patches.length && summary && dropNotes.length) {
    // Keep summary; empty patches — route surfaces soft retry message
    return { summary, patches: [] };
  }
  return { summary, patches };
}

/** Last-resort: pull hex colors from prose into a safe update_tokens patch. */
export function synthesizeTokensFromProse(text: string): AiPatchesResponse | null {
  const hexes = text.match(/#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g);
  if (!hexes?.length) return null;
  const uniq = Array.from(new Set(hexes.map((h) => h.toLowerCase()))).slice(0, 6);
  const colors: Record<string, string> = {};
  if (uniq[0]) colors.primary = uniq[0];
  if (uniq[1]) colors.accent = uniq[1];
  if (uniq[2]) colors.background = uniq[2];
  if (uniq[3]) colors.surface = uniq[3];
  if (uniq[4]) colors.text = uniq[4];
  if (uniq[5]) colors.muted = uniq[5];
  return {
    summary: "Extracted colors from reply / ألوان مستخرجة من الرد",
    patches: [{ op: "update_tokens", tokens: { colors } }],
  };
}

export type ParseAiPatchesResult = {
  data: AiPatchesResponse | null;
  repaired: boolean;
  raw: unknown | null;
  /** Truncated zod / repair notes for repair prompt + UI */
  validationIssues?: string;
};

/** Parse + validate model text; applies deterministic repair when needed. */
export function parseAiPatchesResponse(text: string): ParseAiPatchesResult {
  const raw = extractJsonObject(text);
  if (raw == null) {
    const synth = synthesizeTokensFromProse(text);
    if (synth) return { data: synth, repaired: true, raw: null, validationIssues: "no JSON; synthesized colors" };
    return {
      data: null,
      repaired: false,
      raw: null,
      validationIssues:
        "No JSON object found. styles values must be strings; required pageId/blockId from draft. / لم يُعثر على JSON — قيم styles نصوص، وpageId/blockId من المسودة.",
    };
  }
  const direct = aiPatchesResponseSchema.safeParse(raw);
  if (direct.success) {
    // Still coerce numeric styles inside patches that somehow passed? They can't with strict schema.
    // Re-run through repair to coerce numbers if direct failed partial — direct only succeeds if all string.
    return { data: direct.data, repaired: false, raw };
  }
  const directIssues = JSON.stringify(direct.error.issues.slice(0, 8)).slice(0, 800);
  const repaired = repairAiPatchesResponse(raw);
  if (repaired) {
    const again = aiPatchesResponseSchema.safeParse(repaired);
    if (again.success) {
      return {
        data: again.data,
        repaired: true,
        raw,
        validationIssues: directIssues,
      };
    }
  }
  const synth = synthesizeTokensFromProse(text);
  if (synth) {
    return { data: synth, repaired: true, raw, validationIssues: directIssues };
  }
  return { data: null, repaired: false, raw, validationIssues: directIssues };
}

export const AI_SCHEMA_RULES = `Concrete schema rules:
- Return ONLY {"summary":"string","patches":[...]} max 24 patches. No markdown.
- set_part_style.styles values MUST be strings (paddingX:"24", borderRadius:"999") — never bare numbers.
- update_tokens.tokens.radius may be number; spacing values numbers; colors/fonts string maps.
- Every page/block patch needs real pageId + blockId from the draft JSON (never invent except add_*).
- Prefer: set_nav_items, wire_nav_to_pages, set_button_link, update_tokens, set_part_style, update_copy, update_prop, update_props.
- set_nav_items {pageId,blockId,items:[{label,linkPageSlug|href,linkMode?}]} — server resolves slugs + syncs CSV.
- wire_nav_to_pages {pageId?} syncs navbar(s) to all site pages.
- set_button_link {pageId,blockId,linkMode,linkPageSlug?,href?,key?} for hero/cta/button.`;

export const AI_REPAIR_PROMPT = `Your previous reply was not valid SiteForge patch JSON.
Return ONLY a JSON object: {"summary":"...","patches":[...]} with allowlisted ops.
No markdown fences, no commentary. Max 24 patches. Use real pageId/blockId from the draft.
${AI_SCHEMA_RULES}`;

export function buildAiRepairUserPrompt(failedRaw: string, validationIssues?: string): string {
  const snippet = failedRaw.slice(0, 3500);
  const issues = (validationIssues || "").slice(0, 800);
  return `${AI_REPAIR_PROMPT}

Failed raw model text (fix):
\`\`\`
${snippet}
\`\`\`

Zod / validation issues:
${issues || "(none captured)"}

Fix and return valid JSON only.`;
}

/** Bilingual soft message when JSON ok but 0 patches applied / empty after coerce. */
export const AI_EMPTY_PATCHES_HINT =
  "No edits applied — retry with string style values (e.g. paddingX:\"24\") and real pageId/blockId. / لم يُطبق أي تعديل — أعد المحاولة بقيم styles كنصوص ومعرّفات الصفحة/الكتلة من المسودة.";

export const AI_SYSTEM_PROMPT = SITEFORGE_PLAYBOOK;

export { SITEFORGE_PLAYBOOK } from "@/lib/ai/siteforge-playbook";

