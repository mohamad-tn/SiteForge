import type { SiteContent } from "@/lib/design";

const HEAVY_PROP_KEYS = new Set([
  "customCss",
  "httpAction",
  "motionTimeline",
  "rawHtml",
  "svgMarkup",
]);

const COPY_KEYS = new Set([
  "headline",
  "title",
  "subtitle",
  "body",
  "text",
  "label",
  "cta",
  "ctaLabel",
  "buttonLabel",
  "description",
  "caption",
  "placeholder",
  "items",
  "links",
  "navItems",
  "columns",
]);

function summarizeLocalized(value: unknown, locale: string): unknown {
  if (value == null) return value;
  if (typeof value === "string") return value.slice(0, 400);
  if (Array.isArray(value)) {
    return value.slice(0, 12).map((item) => {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
          if (typeof v === "string") out[k] = v.slice(0, 200);
          else if (v && typeof v === "object" && !Array.isArray(v)) {
            const map = v as Record<string, unknown>;
            out[k] =
              typeof map[locale] === "string"
                ? String(map[locale]).slice(0, 200)
                : typeof map.en === "string"
                  ? String(map.en).slice(0, 200)
                  : Object.values(map).find((x) => typeof x === "string") ?? undefined;
          } else if (typeof v === "number" || typeof v === "boolean") out[k] = v;
        }
        return out;
      }
      return item;
    });
  }
  if (typeof value === "object") {
    const map = value as Record<string, unknown>;
    if (typeof map[locale] === "string") return String(map[locale]).slice(0, 400);
    if (typeof map.en === "string") return String(map.en).slice(0, 400);
    if (typeof map.ar === "string") return String(map.ar).slice(0, 400);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(map)) {
      if (typeof v === "string") out[k] = v.slice(0, 80);
      else if (typeof v === "number" || typeof v === "boolean") out[k] = v;
    }
    return out;
  }
  return value;
}

function compactProps(
  props: Record<string, unknown>,
  locale: string
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (HEAVY_PROP_KEYS.has(key)) continue;
    if (key === "partStyles" && value && typeof value === "object") {
      out.partStyles = value;
      continue;
    }
    if (
      COPY_KEYS.has(key) ||
      key.endsWith("Label") ||
      key.endsWith("Title") ||
      key.endsWith("Text") ||
      key === "href" ||
      key === "ctaHref" ||
      key === "src" ||
      key === "image" ||
      key === "bgColor" ||
      key === "effect" ||
      key === "linkMode" ||
      key === "linkPageSlug" ||
      key === "linkCollectionSlug" ||
      key === "collectionSlug" ||
      key === "actionType" ||
      key === "actionTarget"
    ) {
      out[key] = summarizeLocalized(value, locale);
    } else if (typeof value === "string") {
      out[key] = value.slice(0, 120);
    } else if (typeof value === "number" || typeof value === "boolean") {
      out[key] = value;
    }
  }
  return out;
}

function blockKeyProp(
  props: Record<string, unknown>,
  locale: string
): string | undefined {
  for (const key of ["headline", "title", "label", "cta", "subtitle", "body", "text"]) {
    if (!(key in props)) continue;
    const s = summarizeLocalized(props[key], locale);
    if (typeof s === "string" && s.trim()) return s.slice(0, 80);
  }
  return undefined;
}

type LinkSummary = {
  id?: string;
  label?: unknown;
  linkMode?: string;
  linkPageSlug?: string;
  linkCollectionSlug?: string;
  href?: string;
  actionType?: string;
};

function summarizeLinkish(it: unknown, locale: string): LinkSummary {
  if (!it || typeof it !== "object") return {};
  const o = it as Record<string, unknown>;
  return {
    id: typeof o.id === "string" ? o.id : undefined,
    label: summarizeLocalized(o.label ?? o.title, locale),
    linkMode: typeof o.linkMode === "string" ? o.linkMode : undefined,
    linkPageSlug: typeof o.linkPageSlug === "string" ? o.linkPageSlug : undefined,
    linkCollectionSlug:
      typeof o.linkCollectionSlug === "string" ? o.linkCollectionSlug : undefined,
    href: typeof o.href === "string" ? o.href.slice(0, 80) : undefined,
    actionType: typeof o.actionType === "string" ? o.actionType : undefined,
  };
}

function ctaLinkSummary(props: Record<string, unknown>, locale: string) {
  return {
    linkMode: typeof props.linkMode === "string" ? props.linkMode : undefined,
    linkPageSlug:
      typeof props.linkPageSlug === "string" ? props.linkPageSlug : undefined,
    linkCollectionSlug:
      typeof props.linkCollectionSlug === "string"
        ? props.linkCollectionSlug
        : undefined,
    ctaHref:
      typeof props.ctaHref === "string"
        ? props.ctaHref.slice(0, 80)
        : typeof props.href === "string"
          ? props.href.slice(0, 80)
          : undefined,
    label: summarizeLocalized(props.cta ?? props.ctaLabel ?? props.label, locale),
    actionType: typeof props.actionType === "string" ? props.actionType : undefined,
  };
}

function tokensSummary(content: SiteContent) {
  const c = content.tokens.colors || ({} as SiteContent["tokens"]["colors"]);
  const f = content.tokens.fonts || ({} as SiteContent["tokens"]["fonts"]);
  return {
    primary: c.primary,
    accent: c.accent,
    background: c.background,
    text: c.text,
    fontHeading: f.heading,
    fontBody: f.body,
    radius: content.tokens.radius,
    rtl: content.tokens.rtl,
    themeMode: content.tokens.themeMode,
  };
}

function buildSiteIndex(content: SiteContent, locale: string) {
  const pages = content.pages.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    layout: p.layout || "flow",
    blockCount: p.blocks.length,
  }));

  const navbars: Array<{
    pageId: string;
    blockId: string;
    navItems: LinkSummary[];
    cta?: ReturnType<typeof ctaLinkSummary>;
  }> = [];
  const footers: Array<{
    pageId: string;
    blockId: string;
    links?: LinkSummary[];
  }> = [];
  const ctas: Array<{
    pageId: string;
    blockId: string;
    type: string;
    link: ReturnType<typeof ctaLinkSummary>;
  }> = [];
  const blocksByPage: Record<
    string,
    Array<{ id: string; type: string; key?: string }>
  > = {};

  for (const p of content.pages) {
    const blockIndex: Array<{ id: string; type: string; key?: string }> = [];
    for (const b of p.blocks) {
      const props = (b.props || {}) as Record<string, unknown>;
      const key = blockKeyProp(props, locale);
      blockIndex.push(key ? { id: b.id, type: b.type, key } : { id: b.id, type: b.type });

      if (b.type === "navbar") {
        const items = Array.isArray(props.navItems) ? props.navItems : [];
        navbars.push({
          pageId: p.id,
          blockId: b.id,
          navItems: items.slice(0, 16).map((it) => summarizeLinkish(it, locale)),
          cta: ctaLinkSummary(props, locale),
        });
      } else if (b.type === "footer") {
        const cols = Array.isArray(props.columns)
          ? props.columns
          : Array.isArray(props.links)
            ? props.links
            : Array.isArray(props.items)
              ? props.items
              : [];
        footers.push({
          pageId: p.id,
          blockId: b.id,
          links: cols.slice(0, 16).map((it) => summarizeLinkish(it, locale)),
        });
      } else if (b.type === "cta" || b.type === "button" || b.type === "hero") {
        const link = ctaLinkSummary(props, locale);
        if (
          link.linkMode ||
          link.linkPageSlug ||
          link.ctaHref ||
          link.actionType ||
          b.type === "cta" ||
          b.type === "button"
        ) {
          ctas.push({
            pageId: p.id,
            blockId: b.id,
            type: b.type,
            link,
          });
        }
      }
    }
    blocksByPage[p.id] = blockIndex;
  }

  const components = Array.isArray(content.components)
    ? content.components.map((c) => ({
        id: c.id,
        name: c.name,
        blockCount: c.blocks?.length ?? 0,
      }))
    : [];

  return {
    pages,
    navbars,
    footers,
    ctas: ctas.slice(0, 40),
    tokens: tokensSummary(content),
    locales: content.locales,
    defaultLocale: content.defaultLocale,
    blocksByPage,
    components,
  };
}

export type CompactSiteOptions = {
  activePageId?: string;
  maxJsonChars?: number;
};

/** Compact draft for the model — index first, then active page detail; strip heavy fields. */
export function compactSiteForModel(
  content: SiteContent,
  locale?: string,
  maxJsonCharsOrOpts: number | CompactSiteOptions = 48_000,
  activePageIdArg?: string
): unknown {
  const opts: CompactSiteOptions =
    typeof maxJsonCharsOrOpts === "number"
      ? { maxJsonChars: maxJsonCharsOrOpts, activePageId: activePageIdArg }
      : maxJsonCharsOrOpts || {};
  const maxJsonChars = opts.maxJsonChars ?? 48_000;
  const activePageId = opts.activePageId;

  const loc = locale || content.defaultLocale || content.locales[0] || "ar";
  const index = buildSiteIndex(content, loc);

  const orderedPages = [...content.pages];
  if (activePageId) {
    const idx = orderedPages.findIndex((p) => p.id === activePageId);
    if (idx > 0) {
      const [active] = orderedPages.splice(idx, 1);
      orderedPages.unshift(active);
    }
  }

  const pageDetails = orderedPages.map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    layout: p.layout,
    blocks: p.blocks.map((b) => ({
      id: b.id,
      type: b.type,
      props: compactProps((b.props || {}) as Record<string, unknown>, loc),
    })),
  }));

  const compact = {
    index,
    locales: content.locales,
    defaultLocale: content.defaultLocale,
    meta: (content as { meta?: unknown }).meta ?? undefined,
    pages: pageDetails,
  };
  let json = JSON.stringify(compact);
  if (json.length <= maxJsonChars) return compact;

  // Prefer index + first (active) page full detail; slim other pages to ids/types only
  const slim = {
    index,
    locales: content.locales,
    defaultLocale: content.defaultLocale,
    meta: compact.meta,
    pages: pageDetails.map((p, i) =>
      i === 0
        ? p
        : {
            ...p,
            blocks: p.blocks.map((b) => ({ id: b.id, type: b.type, props: {} })),
          }
    ),
  };
  json = JSON.stringify(slim);
  if (json.length <= maxJsonChars) return slim;

  return {
    index,
    locales: slim.locales,
    defaultLocale: slim.defaultLocale,
    pages: slim.pages.slice(0, 3).map((p) => ({
      ...p,
      blocks: p.blocks.slice(0, 24),
    })),
  };
}

export const AI_MODEL_HISTORY_TURNS = 6;
export const AI_UI_MESSAGE_CAP = 40;
export const AI_MAX_PATCHES = 24;

/** Keep last N chat turns (user+assistant pairs roughly) for the model. */
export function selectRecentChatTurns<T extends { role: string }>(
  messages: T[],
  maxTurns = AI_MODEL_HISTORY_TURNS
): T[] {
  const usable = messages.filter(
    (m) => m.role === "user" || m.role === "assistant" || m.role === "model"
  );
  // ~2 messages per turn
  return usable.slice(-(maxTurns * 2));
}
