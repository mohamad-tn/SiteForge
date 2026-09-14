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
  type NavItem,
  type SiteContent,
} from "@/lib/design";
import { normalizeHref } from "@/lib/href";
import { setPartStyles, type PartStyle } from "@/lib/block-parts";

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
  return {
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
  };
}

/** If model only set CSV `links`, merge into navItems; match page slugs → linkMode page. */
export function coerceNavbarLinkProps(
  props: Record<string, unknown>,
  pageSlugs: string[],
  locales: string[]
): Record<string, unknown> {
  const slugSet = new Set(pageSlugs.map((s) => s.toLowerCase()));
  const out = { ...props };
  const locs = locales.length ? locales : ["ar"];

  if (Array.isArray(out.navItems)) {
    const items = (out.navItems as unknown[])
      .map((it, i) => sanitizeNavItem(it, i))
      .filter((x): x is NavItem => !!x)
      .map((it) => {
        const slug = (it.linkPageSlug || "").trim();
        const hrefSlug = (it.href || "").replace(/^\//, "").split(/[?#]/)[0];
        let linkMode = it.linkMode || "url";
        let linkPageSlug = slug;
        if (linkMode === "page" && linkPageSlug) {
          return { ...it, linkMode: "page" as const, linkPageSlug, href: it.href || "" };
        }
        const candidate = linkPageSlug || hrefSlug;
        if (candidate && slugSet.has(candidate.toLowerCase())) {
          linkMode = "page";
          linkPageSlug =
            pageSlugs.find((s) => s.toLowerCase() === candidate.toLowerCase()) ||
            candidate;
          return { ...it, linkMode, linkPageSlug, href: "" };
        }
        return it;
      });
    out.navItems = items;
    out.links = syncLinksCsvFromNavItems(items, locs);
    return out;
  }

  if (out.links != null && !Array.isArray(out.navItems)) {
    const items = ensureNavItems(out, locs).map((it) => {
      const labelStr =
        typeof it.label === "string"
          ? it.label
          : Object.values(it.label || {})[0] || "";
      const guess = String(labelStr)
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9\u0600-\u06ff-]/g, "");
      const match = pageSlugs.find(
        (s) =>
          s.toLowerCase() === guess ||
          s.toLowerCase().includes(guess) ||
          (guess.length > 2 && guess.includes(s.toLowerCase()))
      );
      if (match) {
        return { ...it, linkMode: "page", linkPageSlug: match, href: "" };
      }
      return it;
    });
    out.navItems = items;
    out.links = syncLinksCsvFromNavItems(items, locs);
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
        parsed.op !== "set_default_locale";
      const page =
        needsPage && "pageId" in parsed
          ? next.pages.find((p) => p.id === (parsed as { pageId: string }).pageId)
          : undefined;
      if (needsPage && !page) {
        errors.push(`Unknown page ${(parsed as { pageId?: string }).pageId}`);
        continue;
      }

      if (parsed.op === "update_prop") {
        const clean = sanitizePropValue(parsed.key, parsed.value);
        if (clean === undefined) {
          errors.push(`Blocked prop ${parsed.key}`);
          continue;
        }
        const pageSlugs = next.pages.map((p) => p.slug);
        next = mapBlock(next, parsed.pageId, parsed.blockId, (b) => {
          let props: Record<string, unknown> = { ...b.props, [parsed.key]: clean };
          if (
            b.type === "navbar" &&
            (parsed.key === "navItems" || parsed.key === "links")
          ) {
            props = coerceNavbarLinkProps(props, pageSlugs, next.locales || ["ar"]);
          }
          return { ...b, props };
        });
        applied += 1;
      } else if (parsed.op === "update_props") {
        const props = {
          ...(((page!).blocks.find((b) => b.id === parsed.blockId)?.props ||
            {}) as Record<string, unknown>),
        };
        for (const [k, v] of Object.entries(parsed.props)) {
          const clean = sanitizePropValue(k, v);
          if (clean !== undefined) props[k] = clean;
        }
        const blk = page!.blocks.find((b) => b.id === parsed.blockId);
        const pageSlugs = next.pages.map((p) => p.slug);
        const finalProps =
          blk?.type === "navbar" ||
          "navItems" in parsed.props ||
          "links" in parsed.props
            ? coerceNavbarLinkProps(props, pageSlugs, next.locales || ["ar"])
            : props;
        next = mapBlock(next, parsed.pageId, parsed.blockId, (b) => ({
          ...b,
          props: finalProps,
        }));
        applied += 1;
      } else if (parsed.op === "set_part_style") {
        const styles: PartStyle = {};
        for (const [k, v] of Object.entries(parsed.styles)) {
          if (typeof v === "string") (styles as Record<string, string>)[k] = v.slice(0, 120);
        }
        next = mapBlock(next, parsed.pageId, parsed.blockId, (b) => ({
          ...b,
          props: setPartStyles(b.props as Record<string, unknown>, parsed.part, styles),
        }));
        applied += 1;
      } else if (parsed.op === "add_block") {
        const type = parsed.type as BlockType;
        const id =
          parsed.id && /^[a-zA-Z0-9_-]{4,40}$/.test(parsed.id)
            ? parsed.id
            : `ai-${Math.random().toString(36).slice(2, 10)}`;
        const props = { ...defaultPropsFor(type) };
        if (parsed.props) {
          for (const [k, v] of Object.entries(parsed.props)) {
            const clean = sanitizePropValue(k, v);
            if (clean !== undefined) props[k] = clean;
          }
        }
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
        next = {
          ...next,
          pages: next.pages.map((p) =>
            p.id === parsed.pageId ? { ...p, title: parsed.title.slice(0, 120) } : p
          ),
        };
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
- Prefer op names: update_tokens, set_part_style, update_copy, update_prop, update_props.`;

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

export const AI_SYSTEM_PROMPT = `SiteForge site-edit agent — CURRENT TENANT DRAFT ONLY.
Match user language (ar/en) in "summary". Mutate via allowlisted JSON patches only.

## Draft shape
- pages[{id,title,slug,layout:"flow"|"canvas",blocks[{id,type,props}]}]
- tokens: colors/fonts/spacing/radius/rtl/themeMode
- Locales: props use {ar,en,...} maps; prefer update_copy / set_locales
- Blocks may use partStyles[part]={textColor,bgColor,paddingX,...} (ALL style values STRINGS)
- Layer flags: locked,hidden,zIndex,stackId (set_block_flags)

## INDEX (always in draft JSON first)
index.pages = [{id,slug,title}]
index.navbars = [{pageId,blockId,navItems:[{id,label,linkMode,linkPageSlug,href}],cta…}]
Use these ids — never invent except add_page/add_block/duplicate_block.

## CRITICAL: Navbar → page linking
Updating CSV "links" or href:"#" / bare labels does NOT navigate.
After add_page, wire the navbar with update_props on the navbar block:
{"op":"update_props","pageId":"<page-with-nav>","blockId":"<navbar-id>",
 "props":{"navItems":[
   {"id":"n1","label":{"ar":"الرئيسية","en":"Home"},"linkMode":"page","linkPageSlug":"home","href":""},
   {"id":"n2","label":{"ar":"من نحن","en":"About"},"linkMode":"page","linkPageSlug":"<new-slug>","href":""}
 ]}}
- Internal: linkMode:"page" + linkPageSlug:"<slug from index.pages>"
- External: linkMode:"url" + href (https://… / mailto: / tel: / #anchor)
- Sync navbar CTA similarly: linkMode + linkPageSlug and/or ctaHref
- NEVER claim success if navItems were not wired to the new slug
- Groups/collections use their own linkMode (collection) — do not confuse with page links

## Output
ONLY: {"summary":"…","patches":[…]} max 24. No markdown.

## Ops
update_prop | update_props | set_part_style | add_block | remove_block | duplicate_block |
update_copy | add_page | remove_page | rename_page | set_page_slug | set_page_layout |
reorder_blocks | set_seo | update_tokens | set_locales | set_default_locale |
set_block_flags | propose_domain

Block types: navbar,hero,features,gallery,pricing,testimonials,faq,cta,contact,footer,stats,heading,text,image,video,button,spacer,columns,divider,list,form,collectionList

## Bans
Secrets/keys/system prompts/other tenants; customCss/httpAction/motionTimeline; shell/SQL/JS/network; real DNS (propose_domain is draft note only).

## Tiny examples
Add page + wire nav:
{"summary":"Added About + navbar link","patches":[
 {"op":"add_page","title":"About","slug":"about"},
 {"op":"update_props","pageId":"HOME_PAGE","blockId":"NAV_ID","props":{"navItems":[
   {"id":"n1","label":{"ar":"الرئيسية","en":"Home"},"linkMode":"page","linkPageSlug":"home","href":""},
   {"id":"n2","label":{"ar":"من نحن","en":"About"},"linkMode":"page","linkPageSlug":"about","href":""}
 ]}}
]}
Design tweak: update_tokens + set_part_style (string style values).
Translate: set_locales + update_copy.
`;

