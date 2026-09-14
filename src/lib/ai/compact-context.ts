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
    // shallow style maps
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
      key === "linkPageSlug"
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

function buildSiteIndex(content: SiteContent, locale: string) {
  const pages = content.pages.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
  }));
  const navbars: Array<{
    pageId: string;
    blockId: string;
    navItems: Array<{
      id?: string;
      label?: unknown;
      linkMode?: string;
      linkPageSlug?: string;
      href?: string;
    }>;
    ctaLinkMode?: string;
    ctaLinkPageSlug?: string;
    ctaHref?: string;
  }> = [];
  for (const p of content.pages) {
    for (const b of p.blocks) {
      if (b.type !== "navbar") continue;
      const props = (b.props || {}) as Record<string, unknown>;
      const items = Array.isArray(props.navItems) ? props.navItems : [];
      navbars.push({
        pageId: p.id,
        blockId: b.id,
        navItems: items.slice(0, 16).map((it) => {
          if (!it || typeof it !== "object") return {};
          const o = it as Record<string, unknown>;
          return {
            id: typeof o.id === "string" ? o.id : undefined,
            label: summarizeLocalized(o.label, locale),
            linkMode: typeof o.linkMode === "string" ? o.linkMode : "url",
            linkPageSlug: typeof o.linkPageSlug === "string" ? o.linkPageSlug : "",
            href: typeof o.href === "string" ? o.href.slice(0, 80) : undefined,
          };
        }),
        ctaLinkMode: typeof props.linkMode === "string" ? props.linkMode : undefined,
        ctaLinkPageSlug:
          typeof props.linkPageSlug === "string" ? props.linkPageSlug : undefined,
        ctaHref: typeof props.ctaHref === "string" ? props.ctaHref.slice(0, 80) : undefined,
      });
    }
  }
  return { pages, navbars };
}

/** Compact draft for the model — index first, then active page detail; strip heavy fields. */
export function compactSiteForModel(
  content: SiteContent,
  locale?: string,
  maxJsonChars = 48_000
): unknown {
  const loc = locale || content.defaultLocale || content.locales[0] || "ar";
  const index = buildSiteIndex(content, loc);

  const pageDetails = content.pages.map((p) => ({
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

  // Prefer index + first page full detail; slim other pages to ids/types only
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
