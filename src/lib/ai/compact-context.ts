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
      key === "effect"
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

/** Compact draft for the model — active locale copy only, strip heavy unused fields. */
export function compactSiteForModel(
  content: SiteContent,
  locale?: string,
  maxJsonChars = 48_000
): unknown {
  const loc = locale || content.defaultLocale || content.locales[0] || "ar";
  const compact = {
    locales: content.locales,
    defaultLocale: content.defaultLocale,
    meta: (content as { meta?: unknown }).meta ?? undefined,
    pages: content.pages.map((p) => ({
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
    })),
  };
  let json = JSON.stringify(compact);
  if (json.length <= maxJsonChars) return compact;
  // Drop props from later pages if still huge
  const slim = {
    ...compact,
    pages: compact.pages.map((p, i) =>
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
    ...slim,
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
