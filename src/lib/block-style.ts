/** Shared visual + link props applied to every block */

export const STYLE_KEYS = [
  "width",
  "height",
  "minWidth",
  "maxWidth",
  "minHeight",
  "maxHeight",
  "paddingY",
  "paddingX",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "marginY",
  "marginX",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "bgColor",
  "textColor",
  "fontSize",
  "fontWeight",
  "letterSpacing",
  "lineHeight",
  "textAlign",
  "borderRadius",
  "radiusTL",
  "radiusTR",
  "radiusBR",
  "radiusBL",
  "borderWidth",
  "borderStyle",
  "borderColor",
  "boxShadow",
  "customShadow",
  "opacity",
  "overflow",
  "display",
  "gap",
  "zIndex",
  "customCss",
  "hidden",
] as const;

export type StyleKey = (typeof STYLE_KEYS)[number];

export const LINK_KEYS = ["href", "ctaHref", "buttonHref", "secondaryHref"] as const;

export function defaultStyleProps(): Record<string, string> {
  return Object.fromEntries(STYLE_KEYS.map((k) => [k, k === "hidden" ? "false" : ""])) as Record<string, string>;
}

export function withEditableDefaults(props: Record<string, unknown>): Record<string, unknown> {
  return {
    ...defaultStyleProps(),
    ...defaultMotionProps(),
    linkMode: "url",
    linkPageSlug: "",
    openInNewTab: "false",
    ...props,
  };
}

export function strProp(p: Record<string, unknown>, key: string, fallback = ""): string {
  const v = p[key];
  return typeof v === "string" ? v : fallback;
}

function px(v: string): string {
  if (!v) return "";
  if (/^\d+(\.\d+)?$/.test(v.trim())) return `${v.trim()}px`;
  return v.trim();
}

const SHADOW_PRESETS: Record<string, string> = {
  sm: "0 4px 14px rgba(28,25,23,0.08)",
  md: "0 12px 40px rgba(28,25,23,0.12)",
  lg: "0 24px 60px rgba(28,25,23,0.18)",
  xl: "0 32px 80px rgba(28,25,23,0.22)",
  soft: "0 8px 30px rgba(13,148,136,0.12)",
  glow: "0 0 0 1px rgba(13,148,136,0.2), 0 12px 40px rgba(13,148,136,0.18)",
};

/** Strip high-risk bits from per-block raw CSS overrides (same spirit as site CSS). */
export function sanitizeBlockCss(raw: string): string {
  if (!raw) return "";
  let css = String(raw).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  css = css.replace(/<!--[\s\S]*?-->/g, "");
  const bad =
    /@import\b|@charset\b|expression\s*\(|-moz-binding\b|behavior\s*:|javascript\s*:|vbscript\s*:|<\/?script|url\s*\(\s*['"]?\s*javascript:/gi;
  let prev = "";
  let i = 0;
  while (css !== prev && i < 6) {
    prev = css;
    css = css.replace(bad, "/* blocked */");
    i += 1;
  }
  return css.slice(0, 4000).trim();
}

export function blockFrameStyle(p: Record<string, unknown>): Record<string, string | number> {
  const style: Record<string, string | number> = {};

  const width = strProp(p, "width");
  const height = strProp(p, "height");
  const minWidth = strProp(p, "minWidth");
  const maxWidth = strProp(p, "maxWidth");
  const minHeight = strProp(p, "minHeight");
  const maxHeight = strProp(p, "maxHeight");
  if (width) style.width = px(width);
  if (height) style.height = px(height);
  if (minWidth) style.minWidth = px(minWidth);
  if (maxWidth) style.maxWidth = px(maxWidth);
  if (minHeight) style.minHeight = px(minHeight);
  if (maxHeight) style.maxHeight = px(maxHeight);

  const py = strProp(p, "paddingY");
  const pxv = strProp(p, "paddingX");
  const pt = strProp(p, "paddingTop") || py;
  const pr = strProp(p, "paddingRight") || pxv;
  const pb = strProp(p, "paddingBottom") || py;
  const pl = strProp(p, "paddingLeft") || pxv;
  if (pt) style.paddingTop = px(pt);
  if (pr) style.paddingRight = px(pr);
  if (pb) style.paddingBottom = px(pb);
  if (pl) style.paddingLeft = px(pl);

  const my = strProp(p, "marginY");
  const mx = strProp(p, "marginX");
  const mt = strProp(p, "marginTop") || my;
  const mr = strProp(p, "marginRight") || mx;
  const mb = strProp(p, "marginBottom") || my;
  const ml = strProp(p, "marginLeft") || mx;
  if (mt) style.marginTop = px(mt);
  if (mr) style.marginRight = px(mr);
  if (mb) style.marginBottom = px(mb);
  if (ml) style.marginLeft = px(ml);

  if (strProp(p, "bgColor")) style.background = strProp(p, "bgColor");
  if (strProp(p, "textColor")) style.color = strProp(p, "textColor");
  if (strProp(p, "fontSize")) style.fontSize = px(strProp(p, "fontSize"));
  const fw = strProp(p, "fontWeight");
  if (fw) style.fontWeight = Number(fw) || fw;
  if (strProp(p, "letterSpacing")) style.letterSpacing = px(strProp(p, "letterSpacing"));
  if (strProp(p, "lineHeight")) style.lineHeight = strProp(p, "lineHeight");
  if (strProp(p, "textAlign")) style.textAlign = strProp(p, "textAlign");

  const rAll = strProp(p, "borderRadius");
  const rtl = strProp(p, "radiusTL") || rAll;
  const rtr = strProp(p, "radiusTR") || rAll;
  const rbr = strProp(p, "radiusBR") || rAll;
  const rbl = strProp(p, "radiusBL") || rAll;
  if (rtl || rtr || rbr || rbl) {
    style.borderTopLeftRadius = px(rtl || "0");
    style.borderTopRightRadius = px(rtr || "0");
    style.borderBottomRightRadius = px(rbr || "0");
    style.borderBottomLeftRadius = px(rbl || "0");
  }

  if (strProp(p, "borderWidth")) {
    style.borderWidth = px(strProp(p, "borderWidth"));
    style.borderStyle = strProp(p, "borderStyle") || "solid";
    style.borderColor = strProp(p, "borderColor") || "transparent";
  } else if (strProp(p, "borderStyle") && strProp(p, "borderStyle") !== "none") {
    style.borderStyle = strProp(p, "borderStyle");
    style.borderColor = strProp(p, "borderColor") || "currentColor";
  }

  const customShadow = strProp(p, "customShadow");
  const shadow = strProp(p, "boxShadow");
  if (customShadow) style.boxShadow = customShadow;
  else if (shadow) style.boxShadow = SHADOW_PRESETS[shadow] || shadow;

  if (strProp(p, "opacity")) {
    const op = Number(strProp(p, "opacity"));
    if (!Number.isNaN(op)) style.opacity = op > 1 ? op / 100 : op;
  }
  if (strProp(p, "overflow")) style.overflow = strProp(p, "overflow");
  if (strProp(p, "display")) style.display = strProp(p, "display");
  if (strProp(p, "gap")) style.gap = px(strProp(p, "gap"));
  if (strProp(p, "zIndex")) {
    const z = Number(strProp(p, "zIndex"));
    if (!Number.isNaN(z)) style.zIndex = z;
  }

  return style;
}

export function resolveBlockHref(
  p: Record<string, unknown>,
  hrefKey: string,
  siteSlug?: string
): { href: string; target?: string; rel?: string } {
  const mode = strProp(p, "linkMode", "url");
  const openNew = strProp(p, "openInNewTab") === "true";
  let href = strProp(p, hrefKey, "#");
  if (mode === "page") {
    const pageSlug = strProp(p, "linkPageSlug", "home");
    href = siteSlug ? `/s/${siteSlug}?p=${encodeURIComponent(pageSlug)}` : `?p=${encodeURIComponent(pageSlug)}`;
  }
  return {
    href: href || "#",
    target: openNew ? "_blank" : undefined,
    rel: openNew ? "noopener noreferrer" : undefined,
  };
}

export const STYLE_LABELS: Record<string, string> = {
  width: "العرض",
  height: "الارتفاع",
  minWidth: "أدنى عرض",
  maxWidth: "أقصى عرض",
  minHeight: "أدنى ارتفاع",
  maxHeight: "أقصى ارتفاع",
  paddingY: "حشو عمودي",
  paddingX: "حشو أفقي",
  paddingTop: "حشو أعلى",
  paddingRight: "حشو يمين",
  paddingBottom: "حشو أسفل",
  paddingLeft: "حشو يسار",
  marginY: "هامش عمودي",
  marginX: "هامش أفقي",
  marginTop: "هامش أعلى",
  marginRight: "هامش يمين",
  marginBottom: "هامش أسفل",
  marginLeft: "هامش يسار",
  bgColor: "لون الخلفية",
  textColor: "لون النص",
  fontSize: "حجم الخط",
  fontWeight: "وزن الخط",
  letterSpacing: "تباعد الحروف",
  lineHeight: "ارتفاع السطر",
  textAlign: "محاذاة النص",
  borderRadius: "استدارة",
  radiusTL: "زاوية أعلى-يسار",
  radiusTR: "زاوية أعلى-يمين",
  radiusBR: "زاوية أسفل-يمين",
  radiusBL: "زاوية أسفل-يسار",
  borderWidth: "سمك الإطار",
  borderStyle: "نمط الإطار",
  borderColor: "لون الإطار",
  boxShadow: "ظل جاهز",
  customShadow: "ظل مخصص (CSS)",
  opacity: "الشفافية",
  overflow: "الفيض",
  display: "العرض (display)",
  gap: "الفجوة",
  zIndex: "Z-Index",
  customCss: "CSS متقدم للعنصر",
  hidden: "إخفاء",
  linkMode: "نوع الرابط",
  linkPageSlug: "صفحة داخلية",
  openInNewTab: "فتح في تبويب جديد",
};

/** Motion / interaction props shared by all blocks */
export const MOTION_KEYS = [
  "effectPreset",
  "entranceAnim",
  "animDuration",
  "animDelay",
  "hoverScale",
  "hoverShadow",
  "scrollReveal",
] as const;

export type MotionKey = (typeof MOTION_KEYS)[number];

/** Friendly effect presets (تأثيرات) — map to entrance + hover props. */
export type EffectPresetId =
  | "none"
  | "soft-fade"
  | "slide-up"
  | "slide-down"
  | "slide-left"
  | "slide-right"
  | "scale-in"
  | "float"
  | "blur-in"
  | "bounce-in"
  | "zoom-fade"
  | "glow-hover"
  | "lift-hover"
  | "soft-lift"
  | "fade-glow"
  | "reveal-lift";

export type EffectPresetDef = {
  id: EffectPresetId;
  entranceAnim: string;
  hoverScale: string;
  hoverShadow: string;
};

export const EFFECT_PRESETS: EffectPresetDef[] = [
  { id: "none", entranceAnim: "none", hoverScale: "none", hoverShadow: "false" },
  { id: "soft-fade", entranceAnim: "fade", hoverScale: "none", hoverShadow: "false" },
  { id: "slide-up", entranceAnim: "slide-up", hoverScale: "none", hoverShadow: "false" },
  { id: "slide-down", entranceAnim: "slide-down", hoverScale: "none", hoverShadow: "false" },
  { id: "slide-left", entranceAnim: "slide-left", hoverScale: "none", hoverShadow: "false" },
  { id: "slide-right", entranceAnim: "slide-right", hoverScale: "none", hoverShadow: "false" },
  { id: "scale-in", entranceAnim: "scale", hoverScale: "none", hoverShadow: "false" },
  { id: "float", entranceAnim: "float", hoverScale: "none", hoverShadow: "false" },
  { id: "blur-in", entranceAnim: "blur-in", hoverScale: "none", hoverShadow: "false" },
  { id: "bounce-in", entranceAnim: "bounce-in", hoverScale: "none", hoverShadow: "false" },
  { id: "zoom-fade", entranceAnim: "zoom-fade", hoverScale: "none", hoverShadow: "false" },
  { id: "glow-hover", entranceAnim: "none", hoverScale: "none", hoverShadow: "glow" },
  { id: "lift-hover", entranceAnim: "none", hoverScale: "md", hoverShadow: "true" },
  { id: "soft-lift", entranceAnim: "slide-up", hoverScale: "sm", hoverShadow: "true" },
  { id: "fade-glow", entranceAnim: "fade", hoverScale: "none", hoverShadow: "glow" },
  { id: "reveal-lift", entranceAnim: "blur-in", hoverScale: "md", hoverShadow: "true" },
];

export function effectPresetProps(id: EffectPresetId): Record<string, string> {
  const row = EFFECT_PRESETS.find((p) => p.id === id) || EFFECT_PRESETS[0];
  return {
    effectPreset: row.id,
    entranceAnim: row.entranceAnim,
    hoverScale: row.hoverScale,
    hoverShadow: row.hoverShadow,
  };
}

/** Infer preset id from stored props (best-effort). */
export function detectEffectPreset(p: Record<string, unknown>): EffectPresetId {
  const stored = strProp(p, "effectPreset");
  if (stored && EFFECT_PRESETS.some((x) => x.id === stored)) return stored as EffectPresetId;
  const anim = strProp(p, "entranceAnim", "none");
  const hoverScale = strProp(p, "hoverScale", "none");
  const hoverShadow = strProp(p, "hoverShadow", "false");
  const match = EFFECT_PRESETS.find(
    (x) => x.entranceAnim === anim && x.hoverScale === hoverScale && x.hoverShadow === hoverShadow
  );
  return match?.id || "none";
}

export function defaultMotionProps(): Record<string, string> {
  return {
    effectPreset: "none",
    entranceAnim: "none",
    animDuration: "600",
    animDelay: "0",
    hoverScale: "none",
    hoverShadow: "false",
    scrollReveal: "false",
  };
}

export const MOTION_LABELS: Record<string, string> = {
  effectPreset: "التأثير",
  entranceAnim: "حركة الدخول",
  animDuration: "المدة (مللي ثانية)",
  animDelay: "التأخير (مللي ثانية)",
  hoverScale: "تكبير عند التمرير",
  hoverShadow: "ظل عند التمرير",
  scrollReveal: "ظهور عند التمرير",
};

const ENTRANCE_CLASS: Record<string, string> = {
  none: "",
  fade: "sf-anim-fade",
  "slide-up": "sf-anim-slide-up",
  "slide-down": "sf-anim-slide-down",
  "slide-left": "sf-anim-slide-left",
  "slide-right": "sf-anim-slide-right",
  scale: "sf-anim-scale",
  float: "sf-anim-float",
  "blur-in": "sf-anim-blur-in",
  "bounce-in": "sf-anim-bounce-in",
  "zoom-fade": "sf-anim-zoom-fade",
};

/** CSS class + style vars for public renderer motion (respects prefers-reduced-motion via CSS). */
export function blockMotionAttrs(p: Record<string, unknown>): {
  className: string;
  style: Record<string, string | number>;
  scrollReveal: boolean;
  hasEntrance: boolean;
} {
  const anim = strProp(p, "entranceAnim", "none");
  const dur = strProp(p, "animDuration", "600");
  const delay = strProp(p, "animDelay", "0");
  const hoverScale = strProp(p, "hoverScale", "none");
  const hoverShadow = strProp(p, "hoverShadow", "false");
  const scrollReveal = strProp(p, "scrollReveal", "false") === "true";

  const classes: string[] = [];
  const entrance = ENTRANCE_CLASS[anim] || "";
  const hasEntrance = Boolean(entrance);
  if (entrance) classes.push("sf-anim", entrance);

  if (hoverScale === "sm") classes.push("sf-hover-scale-sm");
  else if (hoverScale === "md") classes.push("sf-hover-scale-md");
  if (hoverShadow === "true") classes.push("sf-hover-shadow");
  else if (hoverShadow === "glow") classes.push("sf-hover-glow");

  const style: Record<string, string | number> = {};
  if (entrance) {
    const d = Number(dur);
    const dl = Number(delay);
    if (Number.isFinite(d) && d > 0) style["--sf-anim-dur"] = `${d}ms`;
    if (Number.isFinite(dl) && dl >= 0) style["--sf-anim-delay"] = `${dl}ms`;
  }
  return { className: classes.join(" "), style, scrollReveal, hasEntrance };
}
