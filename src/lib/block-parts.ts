/**
 * Atomic edit targets inside composite blocks.
 * part id scheme:
 *   brand | cta | secondary | eyebrow | headline | subheadline | title | subtitle | body | text | button
 *   email | phone | address | submit | success
 *   collectionSlug | columns | limit | cardTitleField | cardBodyField | cardImageField | cardUrlField
 *   link:<id> | item:<id> | column:<id> | field:<id>
 */
import {
  createNavItem,
  ensureNavItems,
  parseCsv,
  parseFaq,
  parseFooterColumns,
  parsePipeItems,
  parsePricingItems,
  parseTestimonials,
  resolveLocalized,
  setLocalized,
  syncLinksCsvFromNavItems,
  type Block,
  type LocalizedString,
  type NavItem,
} from "@/lib/design";

export type BlockPart =
  | "brand"
  | "cta"
  | "secondary"
  | "eyebrow"
  | "headline"
  | "subheadline"
  | "title"
  | "subtitle"
  | "body"
  | "text"
  | "button"
  | "email"
  | "phone"
  | "address"
  | "submit"
  | "success"
  | "collectionSlug"
  | "columns"
  | "limit"
  | "cardTitleField"
  | "cardBodyField"
  | "cardImageField"
  | "cardUrlField"
  | `link:${string}`
  | `item:${string}`
  | `column:${string}`
  | `field:${string}`;

/** @deprecated use BlockPart — kept for navbar call sites */
export type NavbarPart = BlockPart;

export type PartStyle = {
  textColor?: string;
  bgColor?: string;
  borderColor?: string;
  borderWidth?: string;
  borderRadius?: string;
  paddingX?: string;
  paddingY?: string;
  maxWidth?: string;
  width?: string;
  fontSize?: string;
  fontWeight?: string;
  opacity?: string;
  boxShadow?: string;
  hoverBg?: string;
  hoverText?: string;
  focusRing?: string;
};

/** Keys editable via inspector layout/look/colors when a part is selected. */
export const PART_STYLE_KEYS = [
  "textColor",
  "bgColor",
  "borderColor",
  "borderWidth",
  "borderRadius",
  "paddingX",
  "paddingY",
  "maxWidth",
  "width",
  "fontSize",
  "fontWeight",
  "opacity",
  "boxShadow",
  "hoverBg",
  "hoverText",
  "focusRing",
] as const;

export type PartStyleKey = (typeof PART_STYLE_KEYS)[number];

const SHADOW_PRESETS: Record<string, string> = {
  sm: "0 4px 14px rgba(28,25,23,0.08)",
  md: "0 12px 40px rgba(28,25,23,0.12)",
  lg: "0 24px 60px rgba(28,25,23,0.18)",
  xl: "0 32px 80px rgba(28,25,23,0.22)",
  soft: "0 8px 30px rgba(13,148,136,0.12)",
  glow: "0 0 0 1px rgba(13,148,136,0.2), 0 12px 40px rgba(13,148,136,0.18)",
};

function pxUnit(v: string): string {
  if (!v) return "";
  if (/^\d+(\.\d+)?$/.test(v.trim())) return `${v.trim()}px`;
  return v.trim();
}

/** Resolve partStyles entry into inline CSS for SiteRenderer / preview. */
export function partStyleToCss(ps: PartStyle | undefined | null): Record<string, string | number> {
  if (!ps) return {};
  const s: Record<string, string | number> = {};
  if (ps.textColor) s.color = ps.textColor;
  if (ps.bgColor) s.background = ps.bgColor;
  if (ps.fontSize) s.fontSize = pxUnit(ps.fontSize);
  if (ps.fontWeight) s.fontWeight = Number(ps.fontWeight) || ps.fontWeight;
  if (ps.width) s.width = pxUnit(ps.width);
  if (ps.maxWidth) s.maxWidth = pxUnit(ps.maxWidth);
  if (ps.paddingX || ps.paddingY) {
    const py = ps.paddingY ? pxUnit(ps.paddingY) : undefined;
    const pxv = ps.paddingX ? pxUnit(ps.paddingX) : undefined;
    if (py) {
      s.paddingTop = py;
      s.paddingBottom = py;
    }
    if (pxv) {
      s.paddingLeft = pxv;
      s.paddingRight = pxv;
    }
  }
  if (ps.borderRadius) s.borderRadius = pxUnit(ps.borderRadius);
  if (ps.borderWidth) {
    s.borderWidth = pxUnit(ps.borderWidth);
    s.borderStyle = "solid";
    s.borderColor = ps.borderColor || "transparent";
  } else if (ps.borderColor) {
    s.borderColor = ps.borderColor;
  }
  if (ps.boxShadow) s.boxShadow = SHADOW_PRESETS[ps.boxShadow] || ps.boxShadow;
  if (ps.opacity) {
    const op = Number(ps.opacity);
    if (!Number.isNaN(op)) s.opacity = op > 1 ? op / 100 : op;
  }
  if (ps.hoverBg) s["--sf-part-hover-bg"] = ps.hoverBg;
  if (ps.hoverText) s["--sf-part-hover-text"] = ps.hoverText;
  if (ps.focusRing) s["--sf-part-focus-ring"] = ps.focusRing;
  return s;
}

export type FeatureItem = {
  id: string;
  title: LocalizedString;
  body: LocalizedString;
};

export type FooterColumnItem = {
  id: string;
  title: LocalizedString;
  links: LocalizedString; // CSV per locale
};

export type PricingPlanItem = {
  id: string;
  name: LocalizedString;
  price: LocalizedString;
  features: LocalizedString; // pipe-joined feature list per locale (or CSV)
  ctaLabel: LocalizedString;
  highlighted: boolean;
};

export type TestimonialItem = {
  id: string;
  name: LocalizedString;
  role: LocalizedString;
  quote: LocalizedString;
};

export type FaqItem = {
  id: string;
  q: LocalizedString;
  a: LocalizedString;
};

export type FormFieldItem = {
  id: string;
  key: string;
  label: LocalizedString;
};

function rid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function asLocalized(v: unknown, fallback: LocalizedString = ""): LocalizedString {
  if (typeof v === "string" || (v && typeof v === "object" && !Array.isArray(v))) {
    return v as LocalizedString;
  }
  return fallback;
}

export function editingTargetLabel(part: BlockPart | null | undefined, lang: "ar" | "en" = "ar"): string {
  const name = partLabel(part, lang);
  if (!part) return lang === "ar" ? `تحرير القسم بالكامل` : `Editing whole section`;
  return lang === "ar" ? `تحرير: ${name}` : `Editing: ${name}`;
}

export function partLabel(part: BlockPart | null | undefined, lang: "ar" | "en" = "ar"): string {
  if (!part) return lang === "ar" ? "القسم بالكامل" : "Whole block";
  if (part.startsWith("link:")) return lang === "ar" ? "رابط تنقل" : "Nav link";
  if (part.startsWith("item:")) return lang === "ar" ? "عنصر" : "Item";
  if (part.startsWith("column:")) return lang === "ar" ? "عمود تذييل" : "Footer column";
  if (part.startsWith("field:")) return lang === "ar" ? "حقل نموذج" : "Form field";
  const map: Record<string, { ar: string; en: string }> = {
    brand: { ar: "العلامة / الشعار", en: "Brand" },
    cta: { ar: "زر CTA", en: "CTA button" },
    secondary: { ar: "زر ثانوي", en: "Secondary button" },
    eyebrow: { ar: "الشارة العلوية", en: "Eyebrow" },
    headline: { ar: "العنوان الرئيسي", en: "Headline" },
    subheadline: { ar: "العنوان الفرعي", en: "Subheadline" },
    title: { ar: "العنوان", en: "Title" },
    subtitle: { ar: "الوصف الفرعي", en: "Subtitle" },
    body: { ar: "النص", en: "Body" },
    text: { ar: "النص", en: "Text" },
    button: { ar: "الزر", en: "Button" },
    email: { ar: "البريد", en: "Email" },
    phone: { ar: "الهاتف", en: "Phone" },
    address: { ar: "العنوان", en: "Address" },
    submit: { ar: "زر الإرسال", en: "Submit" },
    success: { ar: "رسالة النجاح", en: "Success message" },
    collectionSlug: { ar: "معرّف المجموعة", en: "Collection slug" },
    columns: { ar: "الأعمدة", en: "Columns" },
    limit: { ar: "الحد", en: "Limit" },
    cardTitleField: { ar: "حقل عنوان البطاقة", en: "Card title field" },
    cardBodyField: { ar: "حقل نص البطاقة", en: "Card body field" },
    cardImageField: { ar: "حقل صورة البطاقة", en: "Card image field" },
    cardUrlField: { ar: "حقل رابط البطاقة", en: "Card URL field" },
  };
  return map[part]?.[lang] || part;
}

export function getPartStyles(props: Record<string, unknown>, part: string): PartStyle {
  const raw = props.partStyles;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const entry = (raw as Record<string, unknown>)[part];
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return {};
  const o = entry as Record<string, unknown>;
  const out: PartStyle = {};
  for (const key of PART_STYLE_KEYS) {
    const v = o[key];
    if (typeof v === "string" && v) out[key] = v;
  }
  return out;
}

export function setPartStyles(
  props: Record<string, unknown>,
  part: string,
  patch: PartStyle
): Record<string, unknown> {
  const prev =
    props.partStyles && typeof props.partStyles === "object" && !Array.isArray(props.partStyles)
      ? { ...(props.partStyles as Record<string, PartStyle>) }
      : {};
  const cur: PartStyle = { ...(prev[part] || {}) };
  for (const key of PART_STYLE_KEYS) {
    if (patch[key] !== undefined) {
      if (patch[key] === "") delete cur[key];
      else cur[key] = patch[key];
    }
  }
  const empty = PART_STYLE_KEYS.every((k) => !cur[k]);
  if (empty) delete prev[part];
  else prev[part] = cur;
  return { ...props, partStyles: prev };
}

export function listBlockParts(
  block: Block,
  locale: string,
  fallback = "ar",
  uiLang: "ar" | "en" = "ar"
): { part: BlockPart; label: string; latin?: boolean }[] {
  const p = block.props as Record<string, unknown>;
  const locales = ["ar", "en", "fr", "es"];
  const pl = (part: BlockPart) => partLabel(part, uiLang);
  switch (block.type) {
    case "navbar": {
      const items = ensureNavItems(p, locales);
      return [
        { part: "brand", label: resolveLocalized(p.brand, locale, fallback) || pl("brand") },
        ...items.map((it) => ({
          part: `link:${it.id}` as BlockPart,
          label: resolveLocalized(it.label, locale, fallback) || pl(`link:${it.id}`),
        })),
        { part: "cta", label: resolveLocalized(p.ctaLabel, locale, fallback) || pl("cta") },
      ];
    }
    case "hero":
      return [
        { part: "eyebrow", label: pl("eyebrow") },
        { part: "headline", label: pl("headline") },
        { part: "subheadline", label: pl("subheadline") },
        { part: "cta", label: pl("cta") },
        { part: "secondary", label: pl("secondary") },
      ];
    case "features":
    case "gallery":
    case "stats": {
      const items = ensureFeatureItems(p, locales);
      return [
        { part: "title", label: resolveLocalized(p.title, locale, fallback) || pl("title") },
        ...(block.type !== "stats"
          ? [{ part: "subtitle" as BlockPart, label: resolveLocalized(p.subtitle, locale, fallback) || pl("subtitle") }]
          : []),
        ...items.map((it) => ({
          part: `item:${it.id}` as BlockPart,
          label: resolveLocalized(it.title, locale, fallback) || pl(`item:${it.id}`),
        })),
      ];
    }
    case "pricing": {
      const plans = ensurePricingPlans(p, locales);
      return [
        { part: "title", label: resolveLocalized(p.title, locale, fallback) || pl("title") },
        { part: "subtitle", label: resolveLocalized(p.subtitle, locale, fallback) || pl("subtitle") },
        ...plans.map((it) => ({
          part: `item:${it.id}` as BlockPart,
          label: resolveLocalized(it.name, locale, fallback) || pl(`item:${it.id}`),
        })),
      ];
    }
    case "testimonials": {
      const items = ensureTestimonials(p, locales);
      return [
        { part: "title", label: resolveLocalized(p.title, locale, fallback) || pl("title") },
        ...items.map((it) => ({
          part: `item:${it.id}` as BlockPart,
          label: resolveLocalized(it.name, locale, fallback) || pl(`item:${it.id}`),
        })),
      ];
    }
    case "faq": {
      const items = ensureFaqItems(p, locales);
      return [
        { part: "title", label: resolveLocalized(p.title, locale, fallback) || pl("title") },
        ...items.map((it) => ({
          part: `item:${it.id}` as BlockPart,
          label: resolveLocalized(it.q, locale, fallback) || pl(`item:${it.id}`),
        })),
      ];
    }
    case "cta":
      return [
        { part: "title", label: pl("title") },
        { part: "body", label: pl("body") },
        { part: "button", label: pl("button") },
      ];
    case "footer": {
      const cols = ensureFooterColumns(p, locales);
      return [
        { part: "brand", label: pl("brand") },
        { part: "text", label: pl("text") },
        ...cols.map((c) => ({
          part: `column:${c.id}` as BlockPart,
          label: resolveLocalized(c.title, locale, fallback) || pl(`column:${c.id}`),
        })),
      ];
    }
    case "contact":
      return [
        { part: "title", label: resolveLocalized(p.title, locale, fallback) || pl("title") },
        { part: "subtitle", label: resolveLocalized(p.subtitle, locale, fallback) || pl("subtitle") },
        { part: "email", label: resolveLocalized(p.email, locale, fallback) || pl("email") },
        { part: "phone", label: resolveLocalized(p.phone, locale, fallback) || pl("phone") },
        { part: "address", label: resolveLocalized(p.address, locale, fallback) || pl("address") },
        { part: "button", label: resolveLocalized(p.buttonLabel, locale, fallback) || pl("button") },
      ];
    case "form": {
      const fields = ensureFormFields(p);
      return [
        { part: "title", label: resolveLocalized(p.title, locale, fallback) || pl("title") },
        { part: "subtitle", label: resolveLocalized(p.subtitle, locale, fallback) || pl("subtitle") },
        { part: "submit", label: resolveLocalized(p.submitLabel, locale, fallback) || pl("submit") },
        { part: "success", label: resolveLocalized(p.successMessage, locale, fallback) || pl("success") },
        ...fields.map((f) => ({
          part: `field:${f.id}` as BlockPart,
          label: resolveLocalized(f.label, locale, fallback) || f.key,
        })),
      ];
    }
    case "collectionList":
      return [
        { part: "title", label: resolveLocalized(p.title, locale, fallback) || pl("title") },
        { part: "subtitle", label: resolveLocalized(p.subtitle, locale, fallback) || pl("subtitle") },
        { part: "collectionSlug", label: pl("collectionSlug"), latin: true },
        { part: "columns", label: pl("columns") },
        { part: "limit", label: pl("limit") },
        { part: "cardTitleField", label: pl("cardTitleField"), latin: true },
        { part: "cardBodyField", label: pl("cardBodyField"), latin: true },
        { part: "cardImageField", label: pl("cardImageField"), latin: true },
        { part: "cardUrlField", label: pl("cardUrlField"), latin: true },
      ];
    default:
      return [];
  }
}

export function ensureFeatureItems(props: Record<string, unknown>, locales: string[] = ["ar"]): FeatureItem[] {
  const raw = props.featureItems;
  if (Array.isArray(raw)) {
    return raw
      .map((it, i) => {
        if (!it || typeof it !== "object") return null;
        const o = it as Record<string, unknown>;
        return {
          id: typeof o.id === "string" ? o.id : `feat-${i}`,
          title: asLocalized(o.title),
          body: asLocalized(o.body),
        };
      })
      .filter(Boolean) as FeatureItem[];
  }

  const itemsVal = props.items;
  if (itemsVal && typeof itemsVal === "object" && !Array.isArray(itemsVal)) {
    const map = itemsVal as Record<string, string>;
    const primary = locales.find((l) => typeof map[l] === "string") || Object.keys(map)[0] || "ar";
    const primaryItems = parsePipeItems(map[primary] || "");
    return primaryItems.map((it, i) => {
      const titleMap: Record<string, string> = {};
      const bodyMap: Record<string, string> = {};
      for (const loc of Object.keys(map)) {
        const parts = parsePipeItems(map[loc] || "");
        if (parts[i]) {
          titleMap[loc] = parts[i].title;
          if (parts[i].body) bodyMap[loc] = parts[i].body!;
        }
      }
      if (!titleMap[primary]) titleMap[primary] = it.title;
      if (it.body && !bodyMap[primary]) bodyMap[primary] = it.body;
      return { id: `feat-${i}`, title: titleMap, body: bodyMap };
    });
  }

  return parsePipeItems(itemsVal).map((it, i) => ({
    id: `feat-${i}`,
    title: it.title,
    body: it.body || "",
  }));
}

export function syncFeatureItemsCsv(items: FeatureItem[], locales: string[]): Record<string, string> {
  const fb = locales[0] || "ar";
  const out: Record<string, string> = {};
  for (const loc of locales) {
    out[loc] = items
      .map((it) => {
        const t = resolveLocalized(it.title, loc, fb);
        const b = resolveLocalized(it.body, loc, fb);
        return b ? `${t}|${b}` : t;
      })
      .filter(Boolean)
      .join(",");
  }
  return out;
}

export function createFeatureItem(): FeatureItem {
  return {
    id: rid("feat"),
    title: { ar: "ميزة جديدة", en: "New feature" },
    body: { ar: "وصف قصير", en: "Short description" },
  };
}

export function ensurePricingPlans(props: Record<string, unknown>, locales: string[] = ["ar"]): PricingPlanItem[] {
  const raw = props.pricingPlans;
  if (Array.isArray(raw)) {
    return raw
      .map((it, i) => {
        if (!it || typeof it !== "object") return null;
        const o = it as Record<string, unknown>;
        return {
          id: typeof o.id === "string" ? o.id : `plan-${i}`,
          name: asLocalized(o.name),
          price: asLocalized(o.price),
          features: asLocalized(o.features),
          ctaLabel: asLocalized(o.ctaLabel, { ar: "ابدأ الآن", en: "Get started" }),
          highlighted: Boolean(o.highlighted),
        };
      })
      .filter(Boolean) as PricingPlanItem[];
  }

  const itemsVal = props.items;
  if (itemsVal && typeof itemsVal === "object" && !Array.isArray(itemsVal)) {
    const map = itemsVal as Record<string, string>;
    const primary = locales.find((l) => typeof map[l] === "string") || Object.keys(map)[0] || "ar";
    const primaryPlans = parsePricingItems(map[primary] || "");
    return primaryPlans.map((plan, i) => {
      const nameMap: Record<string, string> = {};
      const priceMap: Record<string, string> = {};
      const featMap: Record<string, string> = {};
      let highlighted = plan.highlighted;
      for (const loc of Object.keys(map)) {
        const parsed = parsePricingItems(map[loc] || "");
        if (parsed[i]) {
          nameMap[loc] = parsed[i].name;
          priceMap[loc] = parsed[i].price;
          featMap[loc] = parsed[i].features.join("|");
          if (parsed[i].highlighted) highlighted = true;
        }
      }
      if (!nameMap[primary]) nameMap[primary] = plan.name;
      if (!priceMap[primary]) priceMap[primary] = plan.price;
      if (!featMap[primary]) featMap[primary] = plan.features.join("|");
      return {
        id: `plan-${i}`,
        name: nameMap,
        price: priceMap,
        features: featMap,
        ctaLabel: { ar: "ابدأ الآن", en: "Get started" },
        highlighted,
      };
    });
  }

  return parsePricingItems(itemsVal).map((plan, i) => ({
    id: `plan-${i}`,
    name: plan.name,
    price: plan.price,
    features: plan.features.join("|"),
    ctaLabel: { ar: "ابدأ الآن", en: "Get started" },
    highlighted: plan.highlighted,
  }));
}

export function syncPricingPlansCsv(plans: PricingPlanItem[], locales: string[]): Record<string, string> {
  const fb = locales[0] || "ar";
  const out: Record<string, string> = {};
  for (const loc of locales) {
    out[loc] = plans
      .map((p) => {
        const name = resolveLocalized(p.name, loc, fb);
        const price = resolveLocalized(p.price, loc, fb);
        const feats = resolveLocalized(p.features, loc, fb);
        const parts = [name, price, ...(feats ? feats.split("|").map((x) => x.trim()).filter(Boolean) : [])];
        if (p.highlighted) parts.push("الأكثر شعبية");
        return parts.join("|");
      })
      .filter(Boolean)
      .join(",");
  }
  return out;
}

export function createPricingPlan(): PricingPlanItem {
  return {
    id: rid("plan"),
    name: { ar: "خطة جديدة", en: "New plan" },
    price: { ar: "0$", en: "$0" },
    features: { ar: "ميزة واحدة|ميزة اثنان", en: "Feature one|Feature two" },
    ctaLabel: { ar: "ابدأ الآن", en: "Get started" },
    highlighted: false,
  };
}

export function ensureTestimonials(props: Record<string, unknown>, locales: string[] = ["ar"]): TestimonialItem[] {
  const raw = props.testimonialItems;
  if (Array.isArray(raw)) {
    return raw
      .map((it, i) => {
        if (!it || typeof it !== "object") return null;
        const o = it as Record<string, unknown>;
        return {
          id: typeof o.id === "string" ? o.id : `tst-${i}`,
          name: asLocalized(o.name),
          role: asLocalized(o.role),
          quote: asLocalized(o.quote),
        };
      })
      .filter(Boolean) as TestimonialItem[];
  }

  const itemsVal = props.items;
  if (itemsVal && typeof itemsVal === "object" && !Array.isArray(itemsVal)) {
    const map = itemsVal as Record<string, string>;
    const primary = locales.find((l) => typeof map[l] === "string") || Object.keys(map)[0] || "ar";
    const primaryItems = parseTestimonials(map[primary] || "");
    return primaryItems.map((it, i) => {
      const nameMap: Record<string, string> = {};
      const roleMap: Record<string, string> = {};
      const quoteMap: Record<string, string> = {};
      for (const loc of Object.keys(map)) {
        const parsed = parseTestimonials(map[loc] || "");
        if (parsed[i]) {
          nameMap[loc] = parsed[i].name;
          roleMap[loc] = parsed[i].role;
          quoteMap[loc] = parsed[i].quote;
        }
      }
      if (!nameMap[primary]) nameMap[primary] = it.name;
      if (!roleMap[primary]) roleMap[primary] = it.role;
      if (!quoteMap[primary]) quoteMap[primary] = it.quote;
      return { id: `tst-${i}`, name: nameMap, role: roleMap, quote: quoteMap };
    });
  }

  return parseTestimonials(itemsVal).map((it, i) => ({
    id: `tst-${i}`,
    name: it.name,
    role: it.role,
    quote: it.quote,
  }));
}

export function syncTestimonialsCsv(items: TestimonialItem[], locales: string[]): Record<string, string> {
  const fb = locales[0] || "ar";
  const out: Record<string, string> = {};
  for (const loc of locales) {
    out[loc] = items
      .map((it) => {
        const name = resolveLocalized(it.name, loc, fb);
        const role = resolveLocalized(it.role, loc, fb);
        const quote = resolveLocalized(it.quote, loc, fb);
        return `${name}|${role}|${quote}`;
      })
      .filter((s) => s.replace(/\|/g, "").trim())
      .join(",");
  }
  return out;
}

export function createTestimonialItem(): TestimonialItem {
  return {
    id: rid("tst"),
    name: { ar: "عميل", en: "Client" },
    role: { ar: "دور", en: "Role" },
    quote: { ar: "شهادة رائعة عن الخدمة.", en: "A great quote about the service." },
  };
}

export function ensureFaqItems(props: Record<string, unknown>, locales: string[] = ["ar"]): FaqItem[] {
  const raw = props.faqItems;
  if (Array.isArray(raw)) {
    return raw
      .map((it, i) => {
        if (!it || typeof it !== "object") return null;
        const o = it as Record<string, unknown>;
        return {
          id: typeof o.id === "string" ? o.id : `faq-${i}`,
          q: asLocalized(o.q),
          a: asLocalized(o.a),
        };
      })
      .filter(Boolean) as FaqItem[];
  }

  const itemsVal = props.items;
  if (itemsVal && typeof itemsVal === "object" && !Array.isArray(itemsVal)) {
    const map = itemsVal as Record<string, string>;
    const primary = locales.find((l) => typeof map[l] === "string") || Object.keys(map)[0] || "ar";
    const primaryItems = parseFaq(map[primary] || "");
    return primaryItems.map((it, i) => {
      const qMap: Record<string, string> = {};
      const aMap: Record<string, string> = {};
      for (const loc of Object.keys(map)) {
        const parsed = parseFaq(map[loc] || "");
        if (parsed[i]) {
          qMap[loc] = parsed[i].q;
          aMap[loc] = parsed[i].a;
        }
      }
      if (!qMap[primary]) qMap[primary] = it.q;
      if (!aMap[primary]) aMap[primary] = it.a;
      return { id: `faq-${i}`, q: qMap, a: aMap };
    });
  }

  return parseFaq(itemsVal).map((it, i) => ({
    id: `faq-${i}`,
    q: it.q,
    a: it.a,
  }));
}

export function syncFaqCsv(items: FaqItem[], locales: string[]): Record<string, string> {
  const fb = locales[0] || "ar";
  const out: Record<string, string> = {};
  for (const loc of locales) {
    out[loc] = items
      .map((it) => {
        const q = resolveLocalized(it.q, loc, fb);
        const a = resolveLocalized(it.a, loc, fb);
        return a ? `${q}|${a}` : q;
      })
      .filter(Boolean)
      .join(",");
  }
  return out;
}

export function createFaqItem(): FaqItem {
  return {
    id: rid("faq"),
    q: { ar: "سؤال جديد؟", en: "New question?" },
    a: { ar: "الإجابة هنا.", en: "Answer here." },
  };
}

const DEFAULT_FIELD_LABELS: Record<string, { ar: string; en: string }> = {
  name: { ar: "الاسم", en: "Name" },
  email: { ar: "البريد", en: "Email" },
  message: { ar: "الرسالة", en: "Message" },
  phone: { ar: "الهاتف", en: "Phone" },
};

export function ensureFormFields(props: Record<string, unknown>): FormFieldItem[] {
  const raw = props.formFields;
  if (Array.isArray(raw)) {
    return raw
      .map((it, i) => {
        if (!it || typeof it !== "object") return null;
        const o = it as Record<string, unknown>;
        const key = typeof o.key === "string" ? o.key : `field${i}`;
        return {
          id: typeof o.id === "string" ? o.id : `fld-${i}`,
          key,
          label: asLocalized(o.label, DEFAULT_FIELD_LABELS[key] || { ar: key, en: key }),
        };
      })
      .filter(Boolean) as FormFieldItem[];
  }

  const cfg = typeof props.fieldsConfig === "string" ? props.fieldsConfig : "name,email,message";
  const keys = cfg
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const labelMap =
    props.fieldLabels && typeof props.fieldLabels === "object" && !Array.isArray(props.fieldLabels)
      ? (props.fieldLabels as Record<string, LocalizedString>)
      : {};
  return keys.map((key) => ({
    id: `fld-${key}`,
    key,
    label: labelMap[key] || DEFAULT_FIELD_LABELS[key] || { ar: key, en: key },
  }));
}

export function syncFormFieldsConfig(fields: FormFieldItem[]): string {
  return fields.map((f) => f.key).filter(Boolean).join(",");
}

export function createFormField(key = "custom"): FormFieldItem {
  return {
    id: rid("fld"),
    key,
    label: DEFAULT_FIELD_LABELS[key] || { ar: key, en: key },
  };
}

export function ensureFooterColumns(props: Record<string, unknown>, locales: string[] = ["ar"]): FooterColumnItem[] {
  const raw = props.footerColumns;
  if (Array.isArray(raw)) {
    return raw
      .map((it, i) => {
        if (!it || typeof it !== "object") return null;
        const o = it as Record<string, unknown>;
        return {
          id: typeof o.id === "string" ? o.id : `col-${i}`,
          title: asLocalized(o.title),
          links: asLocalized(o.links),
        };
      })
      .filter(Boolean) as FooterColumnItem[];
  }

  const colsVal = props.columns;
  if (colsVal && typeof colsVal === "object" && !Array.isArray(colsVal)) {
    const map = colsVal as Record<string, string>;
    const primary = locales.find((l) => typeof map[l] === "string") || Object.keys(map)[0] || "ar";
    const primaryCols = parseFooterColumns(map[primary] || "");
    return primaryCols.map((col, i) => {
      const titleMap: Record<string, string> = {};
      const linksMap: Record<string, string> = {};
      for (const loc of Object.keys(map)) {
        const parsed = parseFooterColumns(map[loc] || "");
        if (parsed[i]) {
          titleMap[loc] = parsed[i].title;
          linksMap[loc] = parsed[i].links.join(",");
        }
      }
      if (!titleMap[primary]) titleMap[primary] = col.title;
      if (!linksMap[primary]) linksMap[primary] = col.links.join(",");
      return { id: `col-${i}`, title: titleMap, links: linksMap };
    });
  }

  return parseFooterColumns(colsVal).map((col, i) => ({
    id: `col-${i}`,
    title: col.title,
    links: col.links.join(","),
  }));
}

export function syncFooterColumnsCsv(cols: FooterColumnItem[], locales: string[]): Record<string, string> {
  const fb = locales[0] || "ar";
  const out: Record<string, string> = {};
  for (const loc of locales) {
    out[loc] = cols
      .map((c) => {
        const title = resolveLocalized(c.title, loc, fb);
        const links = resolveLocalized(c.links, loc, fb);
        return `${title}:${links.replace(/,/g, "|")}`;
      })
      .join(";");
  }
  return out;
}

/** Persist navbar navItems + keep CSV links in sync. */
export function writeNavItems(
  props: Record<string, unknown>,
  items: NavItem[],
  locales: string[]
): Record<string, unknown> {
  return {
    ...props,
    navItems: items,
    links: syncLinksCsvFromNavItems(items, locales),
  };
}

export function writeFeatureItems(
  props: Record<string, unknown>,
  items: FeatureItem[],
  locales: string[]
): Record<string, unknown> {
  return {
    ...props,
    featureItems: items,
    items: syncFeatureItemsCsv(items, locales),
  };
}

export function writePricingPlans(
  props: Record<string, unknown>,
  plans: PricingPlanItem[],
  locales: string[]
): Record<string, unknown> {
  return {
    ...props,
    pricingPlans: plans,
    items: syncPricingPlansCsv(plans, locales),
  };
}

export function writeTestimonials(
  props: Record<string, unknown>,
  items: TestimonialItem[],
  locales: string[]
): Record<string, unknown> {
  return {
    ...props,
    testimonialItems: items,
    items: syncTestimonialsCsv(items, locales),
  };
}

export function writeFaqItems(
  props: Record<string, unknown>,
  items: FaqItem[],
  locales: string[]
): Record<string, unknown> {
  return {
    ...props,
    faqItems: items,
    items: syncFaqCsv(items, locales),
  };
}

export function writeFormFields(
  props: Record<string, unknown>,
  fields: FormFieldItem[]
): Record<string, unknown> {
  const fieldLabels: Record<string, LocalizedString> = {};
  for (const f of fields) fieldLabels[f.key] = f.label;
  return {
    ...props,
    formFields: fields,
    fieldsConfig: syncFormFieldsConfig(fields),
    fieldLabels,
  };
}

export function writeFooterColumns(
  props: Record<string, unknown>,
  cols: FooterColumnItem[],
  locales: string[]
): Record<string, unknown> {
  return {
    ...props,
    footerColumns: cols,
    columns: syncFooterColumnsCsv(cols, locales),
  };
}

export { createNavItem, ensureNavItems, setLocalized, parseCsv };
