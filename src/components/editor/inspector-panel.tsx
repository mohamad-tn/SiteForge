"use client";

import { useState } from "react";
import {
  BLOCK_META,
  FONT_OPTIONS,
  LOCALIZABLE_PROP_KEYS,
  LOCALE_META,
  isLocaleCode,
  resolveLocalized,
  setLocalized,
  type Block,
  type SiteContent,
} from "@/lib/design";
import { STYLE_KEYS, LINK_KEYS, MOTION_KEYS, EFFECT_PRESETS, EASE_PRESETS, detectEffectPreset, effectPresetProps, type EffectPresetId, type EasePresetId } from "@/lib/block-style";
import { propLabel, styleLabel, motionLabel, effectPresetLabel, easePresetLabel } from "@/lib/prop-labels";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { MediaField } from "@/components/editor/media-field";
import { usePlatformLang } from "@/components/platform-lang-provider";
import type { BlockPart } from "@/lib/design";
import {
  AtomicContentEditor,
  ATOMIC_BLOCK_TYPES,
  SelectedPartChip,
} from "@/components/editor/atomic-inspector";
import {
  ApiActionEditor,
  blockShowsClickBehavior,
  blockSupportsHttpAction,
} from "@/components/editor/api-action-editor";


const SELECT_OPTIONS: Record<string, { value: string; label: string }[]> = {
  align: [
    { value: "start", label: "بداية" },
    { value: "center", label: "وسط" },
    { value: "end", label: "نهاية" },
  ],
  level: [
    { value: "h1", label: "H1" },
    { value: "h2", label: "H2" },
    { value: "h3", label: "H3" },
  ],
  variant: [
    { value: "primary", label: "أساسي" },
    { value: "outline", label: "إطار" },
    { value: "ghost", label: "خفيف" },
  ],
  size: [
    { value: "sm", label: "صغير" },
    { value: "md", label: "متوسط" },
    { value: "lg", label: "كبير" },
  ],
  aspect: [
    { value: "16/9", label: "16:9" },
    { value: "4/3", label: "4:3" },
    { value: "1/1", label: "1:1" },
    { value: "3/4", label: "3:4" },
  ],
  ratio: [
    { value: "50/50", label: "50 / 50" },
    { value: "40/60", label: "40 / 60" },
    { value: "60/40", label: "60 / 40" },
  ],
  style: [
    { value: "check", label: "صح" },
    { value: "dot", label: "نقطة" },
    { value: "number", label: "أرقام" },
    { value: "solid", label: "خط" },
  ],
  columns: [
    { value: "2", label: "2" },
    { value: "3", label: "3" },
    { value: "4", label: "4" },
  ],
  showBadge: [
    { value: "true", label: "نعم" },
    { value: "false", label: "لا" },
  ],
  rounded: [
    { value: "true", label: "نعم" },
    { value: "false", label: "لا" },
  ],
  sticky: [
    { value: "true", label: "نعم" },
    { value: "false", label: "لا" },
  ],
  autoplay: [
    { value: "true", label: "نعم" },
    { value: "false", label: "لا" },
  ],
  loop: [
    { value: "true", label: "نعم" },
    { value: "false", label: "لا" },
  ],
  muted: [
    { value: "true", label: "نعم" },
    { value: "false", label: "لا" },
  ],
  controls: [
    { value: "true", label: "نعم" },
    { value: "false", label: "لا" },
  ],
};

const LONG_KEYS = new Set(["body", "items", "columns", "subheadline", "leftBody", "rightBody"]);
const MEDIA_KEYS = new Set(["src", "poster"]);
const HIDDEN_FROM_CONTENT = new Set([
  ...STYLE_KEYS,
  ...MOTION_KEYS,
  "linkMode",
  "linkPageSlug",
  "openInNewTab",
  "href",
  "ctaHref",
  "buttonHref",
  "secondaryHref",
  "navItems",
  "featureItems",
  "footerColumns",
  "pricingPlans",
  "testimonialItems",
  "faqItems",
  "formFields",
  "fieldLabels",
  "partStyles",
  "httpAction",
  "clickBehavior",
]);

type InspTab = "content" | "layout" | "look" | "colors" | "link" | "api" | "motion";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-stone-400 dark:text-stone-500">{children}</h3>;
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] text-stone-500 dark:text-stone-400">{label}</Label>
      <div className="flex items-center gap-1.5">
        <Input
          type="color"
          value={value || "#ffffff"}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 shrink-0 rounded-2xl p-1"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 rounded-2xl font-mono text-[11px]"
          dir="ltr"
          placeholder="auto"
        />
      </div>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  hint,
  min,
  max,
  step,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  const n = value === "" ? undefined : Number(value);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-[11px] text-stone-500 dark:text-stone-400">{label}</Label>
        {hint ? <span className="text-[10px] text-stone-400">{hint}</span> : null}
      </div>
      <div className="flex items-center gap-2">
        {min != null && max != null ? (
          <input
            type="range"
            min={min}
            max={max}
            step={step || 1}
            value={Number.isFinite(n as number) ? (n as number) : min}
            onChange={(e) => onChange(e.target.value)}
            className="h-2 w-full accent-teal-700"
          />
        ) : null}
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-[4.5rem] shrink-0 rounded-2xl text-center text-xs font-mono"
          dir="ltr"
          placeholder="—"
        />
      </div>
    </div>
  );
}

function ContentField({
  propKey,
  value,
  onChange,
  blockType,
  localized,
  uiLang,
}: {
  propKey: string;
  value: string;
  onChange: (v: string) => void;
  blockType: string;
  localized?: boolean;
  uiLang: "ar" | "en";
}) {
  const label = propLabel(propKey, uiLang);
  if (MEDIA_KEYS.has(propKey)) {
    return (
      <MediaField
        label={label}
        value={value}
        onChange={onChange}
        kind={propKey === "poster" ? "image" : blockType === "video" ? "video" : "image"}
        accept={
          blockType === "video" && propKey === "src"
            ? "video/mp4,video/webm,video/quicktime,image/*"
            : "image/*"
        }
      />
    );
  }
  const opts =
    SELECT_OPTIONS[propKey] && !(propKey === "columns" && blockType === "footer")
      ? SELECT_OPTIONS[propKey]
      : null;
  if (opts && !localized) {
    return (
      <div className="space-y-1.5">
        <Label className="text-[11px] text-stone-500 dark:text-stone-400">{label}</Label>
        <Select value={value || opts[0]?.value || ""} onValueChange={onChange} options={opts} />
      </div>
    );
  }
  if (LONG_KEYS.has(propKey) || value.length > 70) {
    return (
      <div className="space-y-1.5">
        <Label className="text-[11px] text-stone-500 dark:text-stone-400">
          {label}
          {localized ? <span className="ms-1 text-teal-700">· locale</span> : null}
        </Label>
        <Textarea value={value} onChange={(e) => onChange(e.target.value)} className="min-h-[96px] rounded-2xl text-sm" dir="auto" />
        {propKey === "items" ? (
          <p className="text-[10px] leading-relaxed text-stone-400" dir="auto">CSV · compound: title|body</p>
        ) : null}
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] text-stone-500 dark:text-stone-400">
        {label}
        {localized ? <span className="ms-1 text-teal-700">· locale</span> : null}
      </Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-10 rounded-2xl text-sm" dir="auto" />
    </div>
  );
}

function Slider({
  label,
  min,
  max,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] text-stone-500 dark:text-stone-400">{label}</Label>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-teal-700" />
    </div>
  );
}

export function InspectorPanel({
  content,
  selected,
  selectedPart = null,
  onSelectPart,
  editLocale,
  pages = [],
  siteId,
  onUpdateTokens,
  onUpdateProp,
  onUpdateLocalizedProp,
  onUpdatePropsObject,
}: {
  content: SiteContent;
  selected: Block | null;
  selectedPart?: BlockPart | null;
  onSelectPart?: (part: BlockPart | null) => void;
  editLocale: string;
  pages?: { slug: string; title: string }[];
  siteId?: string;
  onUpdateTokens: (path: string, value: string | number | boolean) => void;
  onUpdateProp: (blockId: string, key: string, value: string) => void;
  onUpdateLocalizedProp: (blockId: string, key: string, locale: string, value: string) => void;
  onUpdatePropsObject?: (blockId: string, patch: Record<string, unknown>) => void;
}) {
  const { t, lang: uiLang } = usePlatformLang();
  const tokens = content.tokens;
  const dark = tokens.colorsDark || tokens.colors;
  const localeLabel = isLocaleCode(editLocale) ? LOCALE_META[editLocale].nativeLabel : editLocale;
  const [tab, setTab] = useState<InspTab>("content");
  const [showSides, setShowSides] = useState(false);

  const hrefKey =
    selected &&
    (LINK_KEYS.find((k) => k in selected.props) ||
      (selected.type === "button" ? "href" : selected.type === "cta" ? "buttonHref" : selected.type === "hero" ? "ctaHref" : "href"));

  return (
    <div className="space-y-5">
      {/* Design tokens — always available */}
      <details className="group rounded-2xl border border-stone-200/80 open:bg-stone-50/50 dark:border-stone-800 dark:open:bg-stone-950/40">
        <summary className="cursor-pointer list-none px-3 py-2.5 text-[11px] font-bold text-stone-600 dark:text-stone-300">
          {t("tokensTitle")}
        </summary>
        <div className="space-y-4 border-t border-stone-200/70 p-3 dark:border-stone-800">
          <p className="rounded-xl bg-amber-50/80 px-2.5 py-2 text-[10px] leading-5 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100/90">
            {uiLang === "ar"
              ? "هذه الألوان والخطوط تخص موقعك داخل المعاينة فقط — لا تغيّر شريط أدوات SiteForge."
              : "These colors and fonts apply to your site preview only — not the SiteForge toolbar."}
          </p>
          <SectionTitle>ألوان الوضع الفاتح</SectionTitle>
          <div className="grid grid-cols-2 gap-2.5">
            {(
              [
                ["colors.primary", "أساسي", tokens.colors.primary],
                ["colors.secondary", "ثانوي", tokens.colors.secondary],
                ["colors.background", "خلفية", tokens.colors.background],
                ["colors.surface", "سطح", tokens.colors.surface],
                ["colors.text", "نص", tokens.colors.text],
                ["colors.muted", "خفيف", tokens.colors.muted],
                ["colors.accent", "تمييز", tokens.colors.accent],
              ] as const
            ).map(([path, label, value]) => (
              <ColorField key={path} label={label} value={value} onChange={(v) => onUpdateTokens(path, v)} />
            ))}
          </div>
          <SectionTitle>ألوان الوضع الداكن</SectionTitle>
          <div className="grid grid-cols-2 gap-2.5">
            {(
              [
                ["colorsDark.primary", "أساسي", dark.primary],
                ["colorsDark.secondary", "ثانوي", dark.secondary],
                ["colorsDark.background", "خلفية", dark.background],
                ["colorsDark.surface", "سطح", dark.surface],
                ["colorsDark.text", "نص", dark.text],
                ["colorsDark.muted", "خفيف", dark.muted],
                ["colorsDark.accent", "تمييز", dark.accent],
              ] as const
            ).map(([path, label, value]) => (
              <ColorField key={path} label={label} value={value} onChange={(v) => onUpdateTokens(path, v)} />
            ))}
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] text-stone-500 dark:text-stone-400">{t("fontHeading")}</Label>
            <Select
              value={tokens.fonts.heading}
              onValueChange={(v) => onUpdateTokens("fonts.heading", v)}
              options={FONT_OPTIONS.map((f) => ({ value: f, label: f }))}
              triggerClassName="h-9 rounded-xl text-xs font-semibold"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] text-stone-500 dark:text-stone-400">{t("fontBody")}</Label>
            <Select
              value={tokens.fonts.body}
              onValueChange={(v) => onUpdateTokens("fonts.body", v)}
              options={FONT_OPTIONS.map((f) => ({ value: f, label: f }))}
              triggerClassName="h-9 rounded-xl text-xs font-semibold"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] text-stone-500 dark:text-stone-400">{uiLang === "ar" ? "سمة الزائر الافتراضية" : "Default visitor theme"}</Label>
            <Select
              value={tokens.themeMode || "system"}
              onValueChange={(v) => onUpdateTokens("themeMode", v)}
              options={[
                { value: "system", label: uiLang === "ar" ? "حسب النظام" : "System" },
                { value: "light", label: uiLang === "ar" ? "فاتح" : "Light" },
                { value: "dark", label: uiLang === "ar" ? "داكن" : "Dark" },
              ]}
              triggerClassName="h-9 rounded-xl text-xs font-semibold"
            />
          </div>
          <Slider label={`مسافة الأقسام (${tokens.spacing.sectionY}px)`} min={24} max={140} value={tokens.spacing.sectionY} onChange={(v) => onUpdateTokens("spacing.sectionY", v)} />
          <Slider label={`فجوة الكتل (${tokens.spacing.blockGap}px)`} min={8} max={64} value={tokens.spacing.blockGap} onChange={(v) => onUpdateTokens("spacing.blockGap", v)} />
          <Slider label={`عرض المحتوى (${tokens.spacing.contentMaxWidth}px)`} min={720} max={1280} value={tokens.spacing.contentMaxWidth} onChange={(v) => onUpdateTokens("spacing.contentMaxWidth", v)} />
          <Slider label={`استدارة الزوايا (${tokens.radius}px)`} min={8} max={40} value={tokens.radius} onChange={(v) => onUpdateTokens("radius", v)} />
        </div>
      </details>

      {!selected ? (
        <div className="rounded-2xl border border-dashed border-stone-300/80 bg-stone-50/50 p-6 text-center dark:border-stone-700 dark:bg-stone-950/40">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-50 text-teal-800 dark:bg-teal-950/60 dark:text-teal-200">
            <span className="text-lg font-bold" aria-hidden>◇</span>
          </div>
          <p className="text-sm font-medium text-stone-600 dark:text-stone-300">{t("noSelection")}</p>
          <p className="mt-1 text-xs text-stone-400">{t("noSelectionHint")}</p>
          <p className="mt-2 text-[11px] text-stone-400">
            {t("editingIn")} <span className="font-semibold text-teal-800 dark:text-teal-300">{localeLabel}</span>
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-900 dark:bg-teal-950 dark:text-teal-100">
              {BLOCK_META[selected.type].label}
              <span className="font-mono text-[10px] opacity-50">{selected.type}</span>
            </div>
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-stone-600 dark:bg-stone-800 dark:text-stone-300">
              {localeLabel}
            </span>
          </div>

          {ATOMIC_BLOCK_TYPES.has(selected.type) ? (
            <SelectedPartChip
              part={selectedPart}
              lang={uiLang}
              onClear={() => onSelectPart?.(null)}
            />
          ) : null}

          <div className="overflow-x-auto rounded-2xl bg-stone-100/90 p-1 dark:bg-stone-950">
            <div className="flex min-w-max gap-0.5">
              {(
                [
                  ["content", t("groupContent"), t("tipContent")],
                  ["layout", t("groupLayout"), t("tipLayout")],
                  ["look", t("groupLook"), t("tipLook")],
                  ["colors", t("groupColors"), t("tipColors")],
                  ["link", t("groupLink"), t("tipLink")],
                  ...(blockSupportsHttpAction(selected.type)
                    ? [["api", t("groupApi"), t("tipApi")] as [InspTab, string, string]]
                    : []),
                  ["motion", t("groupMotion"), t("tipMotion")],
                ] as [InspTab, string, string][]
              ).map(([k, label, tip]) => (
                <button
                  key={k}
                  type="button"
                  title={tip}
                  onClick={() => setTab(k)}
                  className={`shrink-0 rounded-xl px-2.5 py-1.5 text-[10px] font-semibold transition sm:text-[11px] ${
                    tab === k
                      ? "bg-white text-stone-900 shadow-sm dark:bg-stone-800 dark:text-stone-50"
                      : "text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {tab === "content" ? (
            <div className="space-y-3">
              <p className="rounded-xl bg-stone-50/80 px-2.5 py-2 text-[10px] leading-5 text-stone-500 dark:bg-stone-950/40">{t("tipContent")}</p>
              {ATOMIC_BLOCK_TYPES.has(selected.type) && onUpdatePropsObject ? (
                <AtomicContentEditor
                  block={selected}
                  part={selectedPart}
                  editLocale={editLocale}
                  locales={content.locales?.length ? content.locales : [content.defaultLocale || "ar"]}
                  pages={pages}
                  uiLang={uiLang}
                  onUpdateLocalizedProp={onUpdateLocalizedProp}
                  onUpdateProp={onUpdateProp}
                  onUpdatePropsObject={onUpdatePropsObject}
                  onSelectPart={onSelectPart}
                />
              ) : (
                Object.entries(selected.props)
                  .filter(([key]) => !HIDDEN_FROM_CONTENT.has(key as never))
                  .filter(([key]) => !["navItems", "featureItems", "footerColumns", "pricingPlans", "testimonialItems", "faqItems", "formFields", "fieldLabels", "partStyles"].includes(key))
                  .map(([key, raw]) => {
                    const localized = LOCALIZABLE_PROP_KEYS.has(key);
                    const display = localized
                      ? resolveLocalized(raw, editLocale, content.defaultLocale || "ar")
                      : String(raw ?? "");
                    return (
                      <ContentField uiLang={uiLang}
                        key={key}
                        propKey={key}
                        value={display}
                        blockType={selected.type}
                        localized={localized}
                        onChange={(v) => {
                          if (localized) onUpdateLocalizedProp(selected.id, key, editLocale, v);
                          else onUpdateProp(selected.id, key, v);
                        }}
                      />
                    );
                  })
              )}
              {tab === "content" && selected.type === "navbar" ? (
                <p className="text-[10px] leading-5 text-stone-400 dark:text-stone-500">
                  {uiLang === "ar"
                    ? "نصيحة: انقر الشعار أو رابطاً أو زر CTA داخل المعاينة لتحديده مباشرة."
                    : "Tip: click brand, a link, or CTA inside the preview to focus that part."}
                </p>
              ) : null}
            </div>
          ) : null}

          {tab === "layout" ? (
            <div className="space-y-4">
              <p className="rounded-xl border border-stone-200/80 bg-stone-50/80 px-2.5 py-2 text-[10px] leading-5 text-stone-600 dark:border-stone-800 dark:bg-stone-950/50 dark:text-stone-300">{t("tipLayout")}</p>
              <SectionTitle>{uiLang === "ar" ? "الأبعاد" : "Size"}</SectionTitle>
              <div className="grid grid-cols-2 gap-2.5">
                <NumField label={t("widthLabel")} value={String(selected.props.width ?? "")} onChange={(v) => onUpdateProp(selected.id, "width", v)} hint="px/%" />
                <NumField label="الارتفاع" value={String(selected.props.height ?? "")} onChange={(v) => onUpdateProp(selected.id, "height", v)} hint="px" />
                <NumField label="أقصى عرض" value={String(selected.props.maxWidth ?? "")} onChange={(v) => onUpdateProp(selected.id, "maxWidth", v)} min={200} max={1400} />
                <NumField label="أدنى ارتفاع" value={String(selected.props.minHeight ?? "")} onChange={(v) => onUpdateProp(selected.id, "minHeight", v)} min={0} max={800} />
              </div>
              <SectionTitle>الحشو والهامش</SectionTitle>
              <div className="grid grid-cols-2 gap-2.5">
                <NumField label="حشو عمودي" value={String(selected.props.paddingY ?? "")} onChange={(v) => onUpdateProp(selected.id, "paddingY", v)} min={0} max={120} />
                <NumField label="حشو أفقي" value={String(selected.props.paddingX ?? "")} onChange={(v) => onUpdateProp(selected.id, "paddingX", v)} min={0} max={120} />
                <NumField label="هامش عمودي" value={String(selected.props.marginY ?? "")} onChange={(v) => onUpdateProp(selected.id, "marginY", v)} min={0} max={120} />
                <NumField label="هامش أفقي" value={String(selected.props.marginX ?? "")} onChange={(v) => onUpdateProp(selected.id, "marginX", v)} min={0} max={120} />
              </div>
              <button
                type="button"
                className="text-[11px] font-semibold text-teal-800 dark:text-teal-300"
                onClick={() => setShowSides((s) => !s)}
              >
                {showSides ? "إخفاء التحكم لكل جانب" : "تحكم لكل جانب (أعلى/يمين/أسفل/يسار)"}
              </button>
              {showSides ? (
                <div className="grid grid-cols-2 gap-2.5 rounded-2xl border border-stone-200/80 p-3 dark:border-stone-800">
                  {(
                    [
                      "paddingTop",
                      "paddingRight",
                      "paddingBottom",
                      "paddingLeft",
                      "marginTop",
                      "marginRight",
                      "marginBottom",
                      "marginLeft",
                    ] as const
                  ).map((k) => (
                    <NumField
                      key={k}
                      label={styleLabel(k, uiLang)}
                      value={String(selected.props[k] ?? "")}
                      onChange={(v) => onUpdateProp(selected.id, k, v)}
                      min={0}
                      max={160}
                    />
                  ))}
                </div>
              ) : null}
              <div className="space-y-1.5">
                <Label className="text-[11px] text-stone-500 dark:text-stone-400">{t("hideBlock")}</Label>
                <Select
                  value={String(selected.props.hidden ?? "false")}
                  onValueChange={(v) => onUpdateProp(selected.id, "hidden", v)}
                  options={[
                    { value: "false", label: "ظاهر" },
                    { value: "true", label: "مخفي" },
                  ]}
                />
              </div>
            </div>
          ) : null}

          {tab === "look" ? (
            <div className="space-y-4">
              <p className="rounded-xl border border-stone-200/80 bg-stone-50/80 px-2.5 py-2 text-[10px] leading-5 text-stone-600 dark:border-stone-800 dark:bg-stone-950/50 dark:text-stone-300" title={t("tipLook")}>
                {t("tipLook")}
              </p>
              <SectionTitle>{uiLang === "ar" ? "الخط والنص" : "Type"}</SectionTitle>
              <NumField label={styleLabel("fontSize", uiLang)} value={String(selected.props.fontSize ?? "")} onChange={(v) => onUpdateProp(selected.id, "fontSize", v)} min={10} max={96} />
              <div className="space-y-1.5">
                <Label className="text-[11px] text-stone-500 dark:text-stone-400">{styleLabel("fontWeight", uiLang)}</Label>
                <Select
                  value={String(selected.props.fontWeight ?? "")}
                  onValueChange={(v) => onUpdateProp(selected.id, "fontWeight", v)}
                  options={[
                    { value: "", label: uiLang === "ar" ? "افتراضي" : "Default" },
                    { value: "400", label: uiLang === "ar" ? "عادي" : "Regular" },
                    { value: "500", label: uiLang === "ar" ? "متوسط" : "Medium" },
                    { value: "600", label: uiLang === "ar" ? "شبه عريض" : "Semibold" },
                    { value: "700", label: uiLang === "ar" ? "عريض" : "Bold" },
                    { value: "800", label: uiLang === "ar" ? "ثقيل" : "Heavy" },
                  ]}
                />
              </div>
              <NumField label={styleLabel("lineHeight", uiLang)} value={String(selected.props.lineHeight ?? "")} onChange={(v) => onUpdateProp(selected.id, "lineHeight", v)} hint="1.4" min={1} max={3} step={0.05} />
              <NumField label={styleLabel("letterSpacing", uiLang)} value={String(selected.props.letterSpacing ?? "")} onChange={(v) => onUpdateProp(selected.id, "letterSpacing", v)} min={-2} max={12} step={0.1} />
              <div className="space-y-1.5">
                <Label className="text-[11px] text-stone-500 dark:text-stone-400">{styleLabel("textAlign", uiLang)}</Label>
                <Select
                  value={String(selected.props.textAlign ?? "")}
                  onValueChange={(v) => onUpdateProp(selected.id, "textAlign", v)}
                  options={[
                    { value: "", label: uiLang === "ar" ? "افتراضي" : "Default" },
                    { value: "start", label: uiLang === "ar" ? "بداية" : "Start" },
                    { value: "center", label: uiLang === "ar" ? "وسط" : "Center" },
                    { value: "end", label: uiLang === "ar" ? "نهاية" : "End" },
                  ]}
                />
              </div>
              <SectionTitle>{uiLang === "ar" ? "الإطار والظل" : "Border & shadow"}</SectionTitle>
              <NumField label={styleLabel("borderWidth", uiLang)} value={String(selected.props.borderWidth ?? "")} onChange={(v) => onUpdateProp(selected.id, "borderWidth", v)} min={0} max={16} />
              <NumField label={styleLabel("borderRadius", uiLang)} value={String(selected.props.borderRadius ?? "")} onChange={(v) => onUpdateProp(selected.id, "borderRadius", v)} min={0} max={64} />
              <div className="space-y-1.5">
                <Label className="text-[11px] text-stone-500 dark:text-stone-400">{styleLabel("boxShadow", uiLang)}</Label>
                <Select
                  value={String(selected.props.boxShadow ?? "")}
                  onValueChange={(v) => onUpdateProp(selected.id, "boxShadow", v)}
                  options={[
                    { value: "", label: uiLang === "ar" ? "بدون" : "None" },
                    { value: "sm", label: uiLang === "ar" ? "خفيف" : "Soft" },
                    { value: "md", label: uiLang === "ar" ? "متوسط" : "Medium" },
                    { value: "lg", label: uiLang === "ar" ? "قوي" : "Strong" },
                    { value: "xl", label: uiLang === "ar" ? "كبير جداً" : "Extra" },
                    { value: "soft", label: uiLang === "ar" ? "ناعم ملوّن" : "Colored soft" },
                  ]}
                />
              </div>
              <NumField label={styleLabel("opacity", uiLang)} value={String(selected.props.opacity ?? "")} onChange={(v) => onUpdateProp(selected.id, "opacity", v)} hint="0–1" min={0} max={1} step={0.05} />
            </div>
          ) : null}

          {tab === "colors" ? (
            <div className="space-y-4">
              <p className="rounded-xl border border-stone-200/80 bg-stone-50/80 px-2.5 py-2 text-[10px] leading-5 text-stone-600 dark:border-stone-800 dark:bg-stone-950/50 dark:text-stone-300">
                {t("tipColors")}
              </p>
              <ColorField label={styleLabel("textColor", uiLang)} value={String(selected.props.textColor ?? "")} onChange={(v) => onUpdateProp(selected.id, "textColor", v)} />
              <ColorField label={styleLabel("bgColor", uiLang)} value={String(selected.props.bgColor ?? "")} onChange={(v) => onUpdateProp(selected.id, "bgColor", v)} />
              <ColorField label={styleLabel("borderColor", uiLang)} value={String(selected.props.borderColor ?? "")} onChange={(v) => onUpdateProp(selected.id, "borderColor", v)} />
            </div>
          ) : null}

          {tab === "link" ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-teal-700/15 bg-teal-50/50 px-3 py-2 text-[11px] leading-5 text-stone-600 dark:bg-teal-950/30 dark:text-stone-300">
                {t("tipLink")}
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-stone-500 dark:text-stone-400">نوع الرابط</Label>
                <Select
                  value={String(selected.props.linkMode || "url")}
                  onValueChange={(v) => onUpdateProp(selected.id, "linkMode", v)}
                  options={[
                    { value: "url", label: "رابط خارجي / مخصص" },
                    { value: "page", label: "صفحة داخل الموقع" },
                  ]}
                />
              </div>
              {String(selected.props.linkMode) === "page" ? (
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-stone-500 dark:text-stone-400">الصفحة المستهدفة</Label>
                  <Select
                    value={String(selected.props.linkPageSlug || pages[0]?.slug || "home")}
                    onValueChange={(v) => onUpdateProp(selected.id, "linkPageSlug", v)}
                    options={
                      pages.length
                        ? pages.map((p) => ({ value: p.slug, label: `${p.title} (${p.slug})` }))
                        : [{ value: "home", label: "home" }]
                    }
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-stone-500 dark:text-stone-400">
                    عنوان الرابط {hrefKey ? `(${hrefKey})` : ""}
                  </Label>
                  <Input
                    value={String(selected.props[hrefKey || "href"] ?? "")}
                    onChange={(e) => onUpdateProp(selected.id, hrefKey || "href", e.target.value)}
                    className="h-10 rounded-2xl font-mono text-sm"
                    dir="ltr"
                    placeholder="https://… أو #section"
                  />
                </div>
              )}
              <label className="flex items-center gap-2 rounded-2xl border border-stone-200/80 px-3 py-2.5 text-sm dark:border-stone-800">
                <input
                  type="checkbox"
                  className="accent-teal-700"
                  checked={String(selected.props.openInNewTab) === "true"}
                  onChange={(e) => onUpdateProp(selected.id, "openInNewTab", e.target.checked ? "true" : "false")}
                />
                فتح في تبويب جديد
              </label>
            </div>
          ) : null}

          {tab === "api" && blockSupportsHttpAction(selected.type) ? (
            <div className="space-y-3">
              {onUpdatePropsObject ? (
                <ApiActionEditor
                  props={selected.props}
                  lang={uiLang}
                  siteId={siteId}
                  isForm={selected.type === "form"}
                  showClickBehavior={blockShowsClickBehavior(selected.type)}
                  onChange={(patch) => onUpdatePropsObject(selected.id, patch)}
                />
              ) : (
                <p className="text-xs text-stone-500">تعذّر فتح محرر API</p>
              )}
            </div>
          ) : null}

          {tab === "motion" ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-teal-700/15 bg-teal-50/50 px-3 py-2.5 text-[11px] leading-5 text-stone-600 dark:border-teal-400/20 dark:bg-teal-950/35 dark:text-stone-300">
                <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-teal-800 dark:text-teal-300">{t("effectsTitle")}</div>
                {t("effectsHelp")}
              </div>
              {selectedPart ? (
                <p className="rounded-xl border border-amber-500/20 bg-amber-50/60 px-3 py-2 text-[11px] text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                  {uiLang === "ar"
                    ? "التأثيرات للعنصر كاملاً — الجزء المحدد يعدّل النص/اللون فقط."
                    : "Effects apply to the whole item — the selected part only edits text/color."}
                </p>
              ) : null}
              <div className="space-y-1.5">
                <Label className="text-[11px] text-stone-500 dark:text-stone-400">{motionLabel("effectPreset", uiLang)}</Label>
                <Select
                  value={detectEffectPreset(selected.props as Record<string, unknown>)}
                  onValueChange={(v) => {
                    const patch = effectPresetProps(v as EffectPresetId);
                    if (onUpdatePropsObject) onUpdatePropsObject(selected.id, patch);
                    else {
                      for (const [k, val] of Object.entries(patch)) onUpdateProp(selected.id, k, val);
                    }
                  }}
                  options={EFFECT_PRESETS.map((p) => ({
                    value: p.id,
                    label: effectPresetLabel(p.id, uiLang),
                  }))}
                  triggerClassName="h-9 rounded-xl text-xs font-semibold"
                />
                <p className="text-[10px] leading-4 text-stone-400 dark:text-stone-500">{t("tipMotion")}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-stone-500 dark:text-stone-400">{motionLabel("entranceAnim", uiLang)}</Label>
                <Select
                  value={String(selected.props.entranceAnim || "none")}
                  onValueChange={(v) => onUpdateProp(selected.id, "entranceAnim", v)}
                  options={[
                    { value: "none", label: uiLang === "ar" ? "بدون" : "None" },
                    { value: "fade", label: uiLang === "ar" ? "تلاشي" : "Fade" },
                    { value: "slide-up", label: uiLang === "ar" ? "انزلاق لأعلى" : "Slide up" },
                    { value: "slide-down", label: uiLang === "ar" ? "انزلاق لأسفل" : "Slide down" },
                    { value: "slide-left", label: uiLang === "ar" ? "انزلاق لليسار" : "Slide left" },
                    { value: "slide-right", label: uiLang === "ar" ? "انزلاق لليمين" : "Slide right" },
                    { value: "scale", label: uiLang === "ar" ? "تكبير" : "Scale" },
                    { value: "float", label: uiLang === "ar" ? "طفو" : "Float" },
                    { value: "blur-in", label: uiLang === "ar" ? "ضباب" : "Blur in" },
                    { value: "bounce-in", label: uiLang === "ar" ? "ارتداد" : "Bounce" },
                    { value: "zoom-fade", label: uiLang === "ar" ? "تكبير مع تلاشي" : "Zoom fade" },
                  ]}
                  triggerClassName="h-9 rounded-xl text-xs font-semibold"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-stone-500 dark:text-stone-400">{motionLabel("animEase", uiLang)}</Label>
                <Select
                  value={String(selected.props.animEase || "ease-out")}
                  onValueChange={(v) => onUpdateProp(selected.id, "animEase", v)}
                  options={(Object.keys(EASE_PRESETS) as EasePresetId[]).map((id) => ({
                    value: id,
                    label: easePresetLabel(id, uiLang),
                  }))}
                  triggerClassName="h-9 rounded-xl text-xs font-semibold"
                />
                <p className="text-[10px] leading-4 text-stone-400 dark:text-stone-500">{t("easeHelp")}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-stone-500 dark:text-stone-400">{motionLabel("hoverScale", uiLang)}</Label>
                  <Select
                    value={String(selected.props.hoverScale || "none")}
                    onValueChange={(v) => onUpdateProp(selected.id, "hoverScale", v)}
                    options={[
                      { value: "none", label: uiLang === "ar" ? "بدون" : "None" },
                      { value: "sm", label: uiLang === "ar" ? "خفيف" : "Subtle" },
                      { value: "md", label: uiLang === "ar" ? "واضح" : "Medium" },
                    ]}
                    triggerClassName="h-9 rounded-xl text-xs font-semibold"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-stone-500 dark:text-stone-400">{motionLabel("hoverShadow", uiLang)}</Label>
                  <Select
                    value={String(selected.props.hoverShadow || "false")}
                    onValueChange={(v) => onUpdateProp(selected.id, "hoverShadow", v)}
                    options={[
                      { value: "false", label: uiLang === "ar" ? "بدون" : "None" },
                      { value: "true", label: uiLang === "ar" ? "ظل" : "Shadow" },
                      { value: "glow", label: uiLang === "ar" ? "توهج" : "Glow" },
                    ]}
                    triggerClassName="h-9 rounded-xl text-xs font-semibold"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-stone-500 dark:text-stone-400">{motionLabel("scrollReveal", uiLang)}</Label>
                <Select
                  value={String(selected.props.scrollReveal || "false")}
                  onValueChange={(v) => onUpdateProp(selected.id, "scrollReveal", v)}
                  options={[
                    { value: "false", label: uiLang === "ar" ? "فوراً عند التحميل" : "On page load" },
                    { value: "true", label: uiLang === "ar" ? "عند التمرير للعنصر" : "When scrolled into view" },
                  ]}
                  triggerClassName="h-9 rounded-xl text-xs font-semibold"
                />
                <p className="text-[10px] leading-4 text-stone-400 dark:text-stone-500">{t("scrollRevealHelp")}</p>
              </div>
              <NumField
                label={motionLabel("animDuration", uiLang)}
                value={String(selected.props.animDuration ?? "600")}
                onChange={(v) => onUpdateProp(selected.id, "animDuration", v)}
                min={100}
                max={2000}
                step={50}
                hint="ms"
              />
              <NumField
                label={motionLabel("animDelay", uiLang)}
                value={String(selected.props.animDelay ?? "0")}
                onChange={(v) => onUpdateProp(selected.id, "animDelay", v)}
                min={0}
                max={1500}
                step={50}
                hint="ms"
              />
              <div className="space-y-1.5 rounded-2xl border border-stone-200/80 p-3 dark:border-stone-800">
                <Label className="text-[11px] text-stone-500 dark:text-stone-400">{motionLabel("staggerChildren", uiLang)}</Label>
                <Select
                  value={String(selected.props.staggerChildren || "false")}
                  onValueChange={(v) => onUpdateProp(selected.id, "staggerChildren", v)}
                  options={[
                    { value: "false", label: uiLang === "ar" ? "إيقاف" : "Off" },
                    { value: "true", label: uiLang === "ar" ? "تشغيل" : "On" },
                  ]}
                  triggerClassName="h-9 rounded-xl text-xs font-semibold"
                />
                <p className="text-[10px] leading-4 text-stone-400 dark:text-stone-500">{t("staggerHelp")}</p>
                {String(selected.props.staggerChildren) === "true" ? (
                  <NumField
                    label={motionLabel("staggerMs", uiLang)}
                    value={String(selected.props.staggerMs ?? "80")}
                    onChange={(v) => onUpdateProp(selected.id, "staggerMs", v)}
                    min={40}
                    max={400}
                    step={20}
                    hint="ms"
                  />
                ) : null}
              </div>
            </div>
          ) : null}

        </div>
      )}
    </div>
  );
}

export { setLocalized };
