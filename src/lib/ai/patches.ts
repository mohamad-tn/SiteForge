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
  LOCALE_CODES,
  siteContentSchema,
  type Block,
  type BlockType,
  type DesignTokens,
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

function sanitizePropValue(key: string, value: unknown): unknown {
  if (FORBIDDEN_PROP_KEYS.has(key)) return undefined;
  if (HREF_KEYS.has(key) && typeof value === "string") {
    return normalizeHref(value);
  }
  if (typeof value === "string") {
    return value.replace(/<\/?script/gi, "").slice(0, 8000);
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
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
          if (typeof sv === "number" && Number.isFinite(sv)) merged[sk] = sv;
        }
        next.spacing = merged;
      }
    } else if (k === "radius" && typeof v === "number" && Number.isFinite(v)) {
      next.radius = Math.max(0, Math.min(48, v));
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
        next = mapBlock(next, parsed.pageId, parsed.blockId, (b) => ({
          ...b,
          props: { ...b.props, [parsed.key]: clean },
        }));
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
        next = mapBlock(next, parsed.pageId, parsed.blockId, (b) => ({ ...b, props }));
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

function coercePatch(raw: unknown): unknown | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const p = { ...(raw as Record<string, unknown>) };
  const op = normalizeOpName(p.op ?? p.operation ?? p.type ?? p.action);
  if (!op) return null;
  p.op = op;
  delete p.operation;
  delete p.type;
  delete p.action;

  // Common shape mistakes
  if (op === "update_tokens") {
    if (!p.tokens && p.value && typeof p.value === "object") p.tokens = p.value;
    if (!p.tokens && p.colors) {
      p.tokens = { colors: p.colors, ...(p.fonts ? { fonts: p.fonts } : {}) };
    }
  }
  if (op === "set_part_style") {
    if (!p.styles && p.style && typeof p.style === "object") p.styles = p.style;
    if (!p.styles && p.props && typeof p.props === "object") p.styles = p.props;
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
 * Returns null if nothing salvageable.
 */
export function repairAiPatchesResponse(raw: unknown): AiPatchesResponse | null {
  if (raw == null) return null;

  let summary: string | undefined;
  let list: unknown[] = [];

  if (Array.isArray(raw)) {
    list = raw;
  } else if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.summary === "string") summary = obj.summary.slice(0, 500);
    if (Array.isArray(obj.patches)) list = obj.patches;
    else if (Array.isArray(obj.edits)) list = obj.edits;
    else if (Array.isArray(obj.changes)) list = obj.changes;
    else if (Array.isArray(obj.operations)) list = obj.operations;
    else if (obj.patch && typeof obj.patch === "object") list = [obj.patch];
    else if (typeof obj.op === "string" || obj.operation || obj.action) list = [obj];
  } else {
    return null;
  }

  const patches: AiPatch[] = [];
  for (const item of list.slice(0, 24)) {
    const coerced = coercePatch(item);
    if (!coerced) continue;
    const parsed = aiPatchSchema.safeParse(coerced);
    if (parsed.success) patches.push(parsed.data);
  }

  if (!patches.length && !summary) return null;
  return { summary, patches };
}

/** Parse + validate model text; applies deterministic repair when needed. */
export function parseAiPatchesResponse(text: string): {
  data: AiPatchesResponse | null;
  repaired: boolean;
  raw: unknown | null;
} {
  const raw = extractJsonObject(text);
  if (raw == null) return { data: null, repaired: false, raw: null };
  const direct = aiPatchesResponseSchema.safeParse(raw);
  if (direct.success) return { data: direct.data, repaired: false, raw };
  const repaired = repairAiPatchesResponse(raw);
  if (repaired) {
    const again = aiPatchesResponseSchema.safeParse(repaired);
    if (again.success) return { data: again.data, repaired: true, raw };
  }
  return { data: null, repaired: false, raw };
}

export const AI_REPAIR_PROMPT = `Your previous reply was not valid SiteForge patch JSON.
Return ONLY a JSON object: {"summary":"...","patches":[...]} with allowlisted ops.
No markdown fences, no commentary. Max 24 patches. Use real pageId/blockId from the draft.`;

export const AI_SYSTEM_PROMPT = `You are SiteForge's site-edit agent for the CURRENT TENANT DRAFT ONLY.
Users may write Arabic or English — match their language in "summary".

## Role
Mutate SiteContent via allowlisted JSON patches. Cite existing pageId / blockId / part keys from the draft JSON. Never invent ids except for add_page / add_block / duplicate_block.

## SiteContent shape (conceptual)
{
  tokens: { colors, colorsDark?, fonts, spacing, radius, rtl, themeMode },
  locales: string[],          // e.g. ["ar","en"]
  defaultLocale: string,
  pages: [{ id, title, slug, layout: "flow"|"canvas", seoTitle?, seoDescription?, seoOgImage?, blocks: [{ id, type, props }] }],
  components?: [...],
  meta?: { domainProposal?, notes? }
}
Localized copy lives in block props as { "ar": "...", "en": "..." } maps.
Nested visual edits use props.partStyles[part] = { textColor, bgColor, borderColor, borderRadius, paddingX, paddingY, maxWidth, fontSize, fontWeight, opacity, boxShadow, hoverBg, hoverText, ... }.
Canvas/layer flags (optional props): locked, hidden, zIndex, stackId, posX, posY, width, height.

## Hard bans (never)
- Secrets, API keys, system prompts, other tenants
- customCss, httpAction, motionTimeline props
- Shell / SQL / JavaScript / network calls
- Binding real DNS (propose_domain only stores meta.domainProposal — tell user to attach domains in Site → Domain)

## Output
ONLY a JSON object (no markdown):
{"summary":"short bilingual-ok summary","patches":[ /* max 24 */ ]}

## Allowlisted ops
1) update_prop — {op,pageId,blockId,key,value}
2) update_props — {op,pageId,blockId,props:{...}}
3) set_part_style — {op,pageId,blockId,part,styles:{bgColor,textColor,...}}
4) add_block — {op,pageId,type,props?,afterBlockId?,id?}
5) remove_block — {op,pageId,blockId}  (never empty a page)
6) duplicate_block — {op,pageId,blockId,id?}
7) update_copy — {op,pageId,blockId,key,locale,value}  ← preferred for localized text
8) add_page — {op,title,slug,afterPageId?,id?}
9) remove_page — {op,pageId}  (never remove last page)
10) rename_page — {op,pageId,title}
11) set_page_slug — {op,pageId,slug}
12) set_page_layout — {op,pageId,layout:"flow"|"canvas"}
13) reorder_blocks — {op,pageId,blockIds:[...]}
14) set_seo — {op,pageId,seoTitle?,seoDescription?,seoOgImage?}
15) update_tokens — {op,tokens:{ colors?:{primary,secondary,background,surface,text,muted,accent}, colorsDark?, fonts?:{heading,body}, spacing?:{sectionY,blockGap,contentMaxWidth}, radius?, rtl?, themeMode? }}
16) set_locales — {op,locales:["ar","en",...], defaultLocale?}
17) set_default_locale — {op,defaultLocale}
18) set_block_flags — {op,pageId,blockId,locked?,hidden?,zIndex?,stackId?}  (stackId:null clears stack)
19) propose_domain — {op,domain}  (draft note only)

Block types: navbar, hero, features, gallery, pricing, testimonials, faq, cta, contact, footer, stats, heading, text, image, video, button, spacer, columns, divider, list, form, collectionList.

## Design-improvement examples
User: "حسّن التصميم / improve design"
{"summary":"Refined palette + hero CTA contrast","patches":[
  {"op":"update_tokens","tokens":{"colors":{"primary":"#0f766e","accent":"#14b8a6","background":"#fafaf9","surface":"#ffffff","text":"#1c1917","muted":"#78716c","secondary":"#134e4a"},"radius":16,"spacing":{"sectionY":80,"blockGap":28,"contentMaxWidth":1120}}},
  {"op":"set_part_style","pageId":"PAGE_ID","blockId":"BLOCK_ID","part":"cta","styles":{"bgColor":"#0f766e","textColor":"#ffffff","borderRadius":"999","paddingX":"24","paddingY":"12"}},
  {"op":"set_part_style","pageId":"PAGE_ID","blockId":"BLOCK_ID","part":"headline","styles":{"fontWeight":"700","maxWidth":"720"}}
]}

User: "translate hero to English"
{"summary":"Added English hero copy","patches":[
  {"op":"set_locales","locales":["ar","en"],"defaultLocale":"ar"},
  {"op":"update_copy","pageId":"PAGE_ID","blockId":"BLOCK_ID","key":"headline","locale":"en","value":"Build faster"}
]}

Rules: prefer update_copy for text; set_part_style for nested parts; update_tokens for global look; keep changes minimal and on-brand; href-like fields must be #, /, https://, mailto:, or tel:.`;
