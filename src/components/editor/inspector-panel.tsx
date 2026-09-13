"use client";

import { useEffect, useRef, useState } from "react";
import {
  BLOCK_META,
  LOCALIZABLE_PROP_KEYS,
  LOCALE_META,
  isLocaleCode,
  resolveLocalized,
  setLocalized,
  type Block,
  type SiteContent,
} from "@/lib/design";
import { STYLE_KEYS, LINK_KEYS, MOTION_KEYS, EFFECT_PRESETS, detectEffectPreset, effectPresetProps, type EffectPresetId } from "@/lib/block-style";
import {
  normalizeTimeline,
  writeTimelineProps,
  createTimelineStep,
  defaultEntranceKeyframes,
  normalizeKeyframes,
  sampleStepPreview,
  type MotionKeyframe,
  type MotionTimelineStep,
  type MotionTrigger,
  MOTION_ANIM_IDS,
} from "@/lib/motion-timeline";
import { propLabel, styleLabel, motionLabel, effectPresetLabel } from "@/lib/prop-labels";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { MediaField } from "@/components/editor/media-field";
import { LinkTargetFields } from "@/components/editor/link-target-fields";
import { BezierEaseEditor } from "@/components/editor/bezier-ease-editor";
import { MotionGraphTimeline } from "@/components/editor/motion-graph-timeline";
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
  "linkCollectionSlug",
  "linkCollectionItemHref",
  "linkCollectionItemId",
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
  "instanceOf",
  "stackId",
  "stackAxis",
  "stackIndex",
  "stackGap",
  "stackAlign",
  "layoutMode",
]);

type InspTab = "content" | "layout" | "look" | "colors" | "link" | "api" | "motion";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">{children}</h3>;
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
      <Label className="text-[11px] text-[var(--muted)]">{label}</Label>
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
        <Label className="text-[11px] text-[var(--muted)]">{label}</Label>
        {hint ? <span className="text-[10px] text-[var(--muted)]">{hint}</span> : null}
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
  siteId,
}: {
  propKey: string;
  value: string;
  onChange: (v: string) => void;
  blockType: string;
  localized?: boolean;
  uiLang: "ar" | "en";
  siteId?: string;
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
        siteId={siteId}
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
        <Label className="text-[11px] text-[var(--muted)]">{label}</Label>
        <Select value={value || opts[0]?.value || ""} onValueChange={onChange} options={opts} />
      </div>
    );
  }
  if (LONG_KEYS.has(propKey) || value.length > 70) {
    return (
      <div className="space-y-1.5">
        <Label className="text-[11px] text-[var(--muted)]">
          {label}
          {localized ? <span className="ms-1 text-teal-700">· locale</span> : null}
        </Label>
        <Textarea value={value} onChange={(e) => onChange(e.target.value)} className="min-h-[96px] rounded-2xl text-sm" dir="auto" />
        {propKey === "items" ? (
          <p className="text-[10px] leading-relaxed text-[var(--muted)]" dir="auto">CSV · compound: title|body</p>
        ) : null}
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] text-[var(--muted)]">
        {label}
        {localized ? <span className="ms-1 text-teal-700">· locale</span> : null}
      </Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-10 rounded-2xl text-sm" dir="auto" />
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
  onUpdateProp,
  onUpdateLocalizedProp,
  onUpdatePropsObject,
  onUpdateOriginal,
  onDetachStack,
  onStackMetaChange,
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
  /** Push instance text/style props back onto content.components entry. */
  onUpdateOriginal?: (blockId: string) => void;
  onDetachStack?: (blockId: string) => void;
  onStackMetaChange?: (blockId: string, patch: { gap?: number; align?: "start" | "center" | "end" | "stretch" }) => void;
}) {
  const { t, lang: uiLang } = usePlatformLang();
  const localeLabel = isLocaleCode(editLocale) ? LOCALE_META[editLocale].nativeLabel : editLocale;
  const blockLocked = selected ? String(selected.props.locked ?? "false") === "true" : false;
  const [tab, setTab] = useState<InspTab>("content");
  const [showSides, setShowSides] = useState(false);

  const hrefKey =
    selected &&
    (LINK_KEYS.find((k) => k in selected.props) ||
      (selected.type === "button" ? "href" : selected.type === "cta" ? "buttonHref" : selected.type === "hero" ? "ctaHref" : "href"));

  return (
    <div className="space-y-5" data-sf-inspector="">
      {selected && String(selected.props.locked ?? "false") === "true" ? (
        <div className="rounded-2xl border border-amber-400/50 bg-amber-50/90 px-3 py-2.5 text-[11px] leading-5 text-amber-950 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-semibold">{t("lockedHint")}</p>
          <button
            type="button"
            className="mt-2 rounded-full bg-teal-800 px-3 py-1 text-[11px] font-bold text-white hover:bg-teal-700"
            onClick={() => onUpdateProp(selected.id, "locked", "false")}
          >
            {t("unlockBlock")}
          </button>
        </div>
      ) : null}

      {!selected ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-6 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-50 text-teal-800 dark:bg-teal-950/60 dark:text-teal-200">
            <span className="text-lg font-bold" aria-hidden>◇</span>
          </div>
          <p className="text-sm font-medium text-[var(--muted)]">{t("noSelection")}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">{t("noSelectionHint")}</p>
          <p className="mt-2 text-[11px] text-[var(--muted)]">
            {t("editingIn")} <span className="font-semibold text-teal-800 dark:text-teal-300">{localeLabel}</span>
          </p>
        </div>
      ) : blockLocked ? null : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-900 dark:bg-teal-950 dark:text-teal-100">
              {BLOCK_META[selected.type].label}
              <span className="font-mono text-[10px] opacity-50">{selected.type}</span>
            </div>
            <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-[10px] font-semibold text-[var(--muted)]">
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

          {typeof selected.props.instanceOf === "string" && selected.props.instanceOf ? (
            <InstanceChip
              instanceOf={String(selected.props.instanceOf)}
              content={content}
              uiLang={uiLang}
              t={t}
              onUpdateOriginal={() => onUpdateOriginal?.(selected.id)}
              onDetach={() => {
                if (onUpdatePropsObject) onUpdatePropsObject(selected.id, { instanceOf: "" });
                else onUpdateProp(selected.id, "instanceOf", "");
              }}
            />
          ) : null}

          {typeof selected.props.stackId === "string" && selected.props.stackId ? (
            <StackChip
              stackId={String(selected.props.stackId)}
              stackAxis={String(selected.props.stackAxis || "y")}
              stackGap={String(selected.props.stackGap ?? "16")}
              stackAlign={String(selected.props.stackAlign || "start")}
              t={t}
              onDetach={() => onDetachStack?.(selected.id)}
              onGapChange={(gap) => onStackMetaChange?.(selected.id, { gap })}
              onAlignChange={(align) => onStackMetaChange?.(selected.id, { align })}
            />
          ) : null}

          <div className="overflow-x-auto rounded-2xl bg-[var(--surface)] p-1">
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
                      ? "bg-[var(--foreground)] text-[var(--card)] shadow-sm"
                      : "text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {tab === "content" ? (
            <div className="space-y-3">
              <p className="rounded-xl bg-[var(--surface)] px-2.5 py-2 text-[10px] leading-5 text-[var(--muted)]">{t("tipContent")}</p>
              {ATOMIC_BLOCK_TYPES.has(selected.type) && onUpdatePropsObject ? (
                <AtomicContentEditor
                  block={selected}
                  part={selectedPart}
                  editLocale={editLocale}
                  locales={content.locales?.length ? content.locales : [content.defaultLocale || "ar"]}
                  pages={pages}
                  siteId={siteId}
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
                        siteId={siteId}
                        onChange={(v) => {
                          if (localized) onUpdateLocalizedProp(selected.id, key, editLocale, v);
                          else onUpdateProp(selected.id, key, v);
                        }}
                      />
                    );
                  })
              )}
              {tab === "content" && selected.type === "navbar" ? (
                <p className="text-[10px] leading-5 text-[var(--muted)]">
                  {uiLang === "ar"
                    ? "نصيحة: انقر الشعار أو رابطاً أو زر CTA داخل المعاينة لتحديده مباشرة."
                    : "Tip: click brand, a link, or CTA inside the preview to focus that part."}
                </p>
              ) : null}
            </div>
          ) : null}

          {tab === "layout" ? (
            <div className="space-y-4">
              <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-[10px] leading-5 text-[var(--muted)]">{t("tipLayout")}</p>
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
                <div className="grid grid-cols-2 gap-2.5 rounded-2xl border border-[var(--border)] p-3">
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
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-[var(--muted)]">{t("hideBlock")}</Label>
                  <Select
                    value={String(selected.props.hidden ?? "false")}
                    onValueChange={(v) => onUpdateProp(selected.id, "hidden", v)}
                    options={[
                      { value: "false", label: t("showBlock") },
                      { value: "true", label: t("hideBlock") },
                    ]}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-[var(--muted)]">{t("lockBlock")}</Label>
                  <Select
                    value={String(selected.props.locked ?? "false")}
                    onValueChange={(v) => onUpdateProp(selected.id, "locked", v)}
                    options={[
                      { value: "false", label: t("unlockBlock") },
                      { value: "true", label: t("lockBlock") },
                    ]}
                  />
                </div>
              </div>
            </div>
          ) : null}

          {tab === "look" ? (
            <div className="space-y-4">
              <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-[10px] leading-5 text-[var(--muted)]" title={t("tipLook")}>
                {t("tipLook")}
              </p>
              <SectionTitle>{uiLang === "ar" ? "الخط والنص" : "Type"}</SectionTitle>
              <NumField label={styleLabel("fontSize", uiLang)} value={String(selected.props.fontSize ?? "")} onChange={(v) => onUpdateProp(selected.id, "fontSize", v)} min={10} max={96} />
              <div className="space-y-1.5">
                <Label className="text-[11px] text-[var(--muted)]">{styleLabel("fontWeight", uiLang)}</Label>
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
                <Label className="text-[11px] text-[var(--muted)]">{styleLabel("textAlign", uiLang)}</Label>
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
                <Label className="text-[11px] text-[var(--muted)]">{styleLabel("boxShadow", uiLang)}</Label>
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
              <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-[10px] leading-5 text-[var(--muted)]">
                {t("tipColors")}
              </p>
              <ColorField label={styleLabel("textColor", uiLang)} value={String(selected.props.textColor ?? "")} onChange={(v) => onUpdateProp(selected.id, "textColor", v)} />
              <ColorField label={styleLabel("bgColor", uiLang)} value={String(selected.props.bgColor ?? "")} onChange={(v) => onUpdateProp(selected.id, "bgColor", v)} />
              <ColorField label={styleLabel("borderColor", uiLang)} value={String(selected.props.borderColor ?? "")} onChange={(v) => onUpdateProp(selected.id, "borderColor", v)} />
            </div>
          ) : null}

          {tab === "link" ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-teal-700/15 bg-teal-50/50 px-3 py-2 text-[11px] leading-5 text-[var(--foreground)] dark:bg-teal-950/30">
                {t("tipLink")}
              </div>
              <LinkTargetFields
                props={selected.props as Record<string, unknown>}
                hrefKey={hrefKey || "href"}
                pages={pages}
                siteId={siteId}
                onUpdateProp={(key, value) => onUpdateProp(selected.id, key, value)}
              />
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
                <p className="text-xs text-[var(--muted)]">تعذّر فتح محرر API</p>
              )}
            </div>
          ) : null}

          {tab === "motion" ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-teal-700/15 bg-teal-50/50 px-3 py-2.5 text-[11px] leading-5 text-[var(--muted)] dark:border-teal-400/20 dark:bg-teal-950/35">
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
                <Label className="text-[11px] text-[var(--muted)]">{motionLabel("effectPreset", uiLang)}</Label>
                <Select
                  value={detectEffectPreset(selected.props as Record<string, unknown>)}
                  onValueChange={(v) => {
                    const patch = effectPresetProps(v as EffectPresetId);
                    const props = { ...(selected.props as Record<string, unknown>), ...patch };
                    const steps = normalizeTimeline(props).map((s, i) =>
                      i === 0
                        ? {
                            ...s,
                            anim: patch.entranceAnim || s.anim,
                            trigger: String(props.scrollReveal) === "true" ? ("scroll" as const) : s.trigger,
                          }
                        : s
                    );
                    const next = writeTimelineProps(props, steps.length ? steps : [createTimelineStep({ anim: patch.entranceAnim || "fade" })]);
                    if (onUpdatePropsObject) onUpdatePropsObject(selected.id, { ...patch, ...next });
                    else {
                      for (const [k, val] of Object.entries({ ...patch, ...next })) {
                        if (typeof val === "string") onUpdateProp(selected.id, k, val);
                      }
                    }
                  }}
                  options={EFFECT_PRESETS.map((p) => ({
                    value: p.id,
                    label: effectPresetLabel(p.id, uiLang),
                  }))}
                  triggerClassName="h-9 rounded-xl text-xs font-semibold"
                />
                <p className="text-[10px] leading-4 text-[var(--muted)]">{t("tipMotion")}</p>
              </div>

              <MotionTimelineEditor
                blockId={selected.id}
                props={selected.props as Record<string, unknown>}
                uiLang={uiLang}
                t={t}
                onChange={(steps) => {
                  const next = writeTimelineProps(selected.props as Record<string, unknown>, steps);
                  if (onUpdatePropsObject) onUpdatePropsObject(selected.id, next);
                  else {
                    for (const [k, val] of Object.entries(next)) {
                      if (typeof val === "string") onUpdateProp(selected.id, k, val);
                    }
                  }
                }}
              />

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-[var(--muted)]">{motionLabel("hoverScale", uiLang)}</Label>
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
                  <Label className="text-[11px] text-[var(--muted)]">{motionLabel("hoverShadow", uiLang)}</Label>
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
            </div>
          ) : null}

        </div>
      )}
    </div>
  );
}


function StackChip({
  stackId,
  stackAxis,
  stackGap,
  stackAlign,
  t,
  onDetach,
  onGapChange,
  onAlignChange,
}: {
  stackId: string;
  stackAxis: string;
  stackGap: string;
  stackAlign: string;
  t: (key: string) => string;
  onDetach: () => void;
  onGapChange: (gap: number) => void;
  onAlignChange: (align: "start" | "center" | "end" | "stretch") => void;
}) {
  const shortId = stackId.length > 12 ? `${stackId.slice(0, 10)}…` : stackId;
  const axisLabel = stackAxis === "x" ? "H" : "V";
  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-3 py-2"
      data-sf-no-space-pan=""
    >
      <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-2.5 py-1 text-[10px] font-bold text-teal-900 dark:bg-teal-950 dark:text-teal-100">
        <span aria-hidden>⧉</span>
        {t("canvasStackChip")}
        <span className="font-mono opacity-70">· {axisLabel} · {shortId}</span>
      </span>
      <label className="flex items-center gap-1 text-[10px] font-bold text-[var(--muted)]" title={t("canvasStackGap")}>
        <span>{t("canvasStackGap")}</span>
        <input
          type="number"
          min={0}
          step={1}
          value={stackGap}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) onGapChange(Math.max(0, n));
          }}
          className="h-7 w-14 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-1 text-center font-mono text-[10px] font-bold text-[var(--foreground)]"
          dir="ltr"
        />
      </label>
      <label className="flex items-center gap-1 text-[10px] font-bold text-[var(--muted)]" title={t("canvasStackAlign")}>
        <span>{t("canvasStackAlign")}</span>
        <select
          value={["start", "center", "end", "stretch"].includes(stackAlign) ? stackAlign : "start"}
          onChange={(e) => onAlignChange(e.target.value as "start" | "center" | "end" | "stretch")}
          className="h-7 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-1.5 text-[10px] font-bold text-[var(--foreground)]"
        >
          <option value="start">{t("alignStart")}</option>
          <option value="center">{t("alignCenter")}</option>
          <option value="end">{t("alignEnd")}</option>
          <option value="stretch">{t("canvasStackStretch")}</option>
        </select>
      </label>
      <button
        type="button"
        className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[10px] font-bold text-[var(--foreground)] hover:bg-[var(--card)]"
        onClick={onDetach}
      >
        {t("canvasStackDetach")}
      </button>
    </div>
  );
}

function InstanceChip({
  instanceOf,
  content,
  uiLang,
  t,
  onUpdateOriginal,
  onDetach,
}: {
  instanceOf: string;
  content: SiteContent;
  uiLang: "ar" | "en";
  t: (key: string) => string;
  onUpdateOriginal?: () => void;
  onDetach: () => void;
}) {
  const cmp = (content.components || []).find((c) => c.id === instanceOf);
  const name = cmp?.name || instanceOf;
  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-3 py-2"
      data-sf-no-space-pan=""
    >
      <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-2.5 py-1 text-[10px] font-bold text-teal-900 dark:bg-teal-950 dark:text-teal-100">
        <span aria-hidden>◇</span>
        {t("instanceOfLabel")}
        <span className="font-semibold opacity-80">· {name}</span>
      </span>
      <button
        type="button"
        className="rounded-full bg-teal-800 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-teal-700 disabled:opacity-40"
        disabled={!cmp || !onUpdateOriginal}
        title={uiLang === "ar" ? "نسخ النص والأنماط إلى الأصل المحفوظ" : "Copy text/style props back to the saved original"}
        onClick={() => onUpdateOriginal?.()}
      >
        {t("updateOriginal")}
      </button>
      <button
        type="button"
        className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[10px] font-bold text-[var(--foreground)] hover:bg-[var(--card)]"
        onClick={onDetach}
      >
        {t("detachInstance")}
      </button>
    </div>
  );
}

function applyMotionPreviewToDom(blockId: string, sample: ReturnType<typeof sampleStepPreview> | null) {
  if (typeof document === "undefined") return;
  const root = document.querySelector('[data-sf-preview="content"]');
  if (!root) return;
  const el = root.querySelector(`[data-block-id="${CSS.escape(blockId)}"]`) as HTMLElement | null;
  if (!el) return;
  if (!sample) {
    el.removeAttribute("data-sf-motion-preview");
    el.style.removeProperty("--sf-preview-opacity");
    el.style.removeProperty("--sf-preview-transform");
    el.style.removeProperty("opacity");
    el.style.removeProperty("transform");
    return;
  }
  el.setAttribute("data-sf-motion-preview", "1");
  el.style.setProperty("--sf-preview-opacity", String(sample.opacity));
  el.style.setProperty("--sf-preview-transform", sample.transform);
  el.style.opacity = String(sample.opacity);
  el.style.transform = sample.transform;
}

function MotionTimelineEditor({
  blockId,
  props,
  uiLang,
  t,
  onChange,
}: {
  blockId: string;
  props: Record<string, unknown>;
  uiLang: "ar" | "en";
  t: (key: string) => string;
  onChange: (steps: MotionTimelineStep[]) => void;
}) {
  const steps = normalizeTimeline(props);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [selectedKeyframeT, setSelectedKeyframeT] = useState<number | null>(null);
  const [previewT, setPreviewT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const playRaf = useRef(0);
  const playStarted = useRef(0);
  const activeStepId =
    (selectedStepId && steps.some((s) => s.id === selectedStepId) ? selectedStepId : null) ||
    steps[0]?.id ||
    null;
  const activeStep = steps.find((s) => s.id === activeStepId) || null;
  const activeDurationMs = activeStep?.durationMs ?? 600;
  const activeAnim = activeStep?.anim ?? "fade";
  const activeKeysJson = JSON.stringify(activeStep?.keyframes ?? null);

  const previewTRef = useRef(previewT);
  previewTRef.current = previewT;

  useEffect(() => {
    if (!activeStepId) {
      applyMotionPreviewToDom(blockId, null);
      return;
    }
    const step = steps.find((s) => s.id === activeStepId);
    if (!step) {
      applyMotionPreviewToDom(blockId, null);
      return;
    }
    applyMotionPreviewToDom(blockId, sampleStepPreview(step, previewT));
  }, [activeStepId, previewT, blockId, activeAnim, activeKeysJson, steps]);

  useEffect(() => {
    return () => {
      applyMotionPreviewToDom(blockId, null);
      if (playRaf.current) cancelAnimationFrame(playRaf.current);
    };
  }, [blockId]);

  useEffect(() => {
    if (!playing || !activeStepId) return;
    const duration = Math.max(100, activeDurationMs || 600);
    playStarted.current = performance.now() - previewTRef.current * duration;
    const tick = (now: number) => {
      const u = Math.min(1, Math.max(0, (now - playStarted.current) / duration));
      setPreviewT(u);
      if (u >= 1) {
        setPlaying(false);
        playRaf.current = 0;
        return;
      }
      playRaf.current = requestAnimationFrame(tick);
    };
    playRaf.current = requestAnimationFrame(tick);
    return () => {
      if (playRaf.current) cancelAnimationFrame(playRaf.current);
    };
  }, [playing, activeStepId, activeDurationMs]);

  const animOptions = MOTION_ANIM_IDS.map((id) => ({
    value: id,
    label:
      id === "none"
        ? uiLang === "ar"
          ? "بدون"
          : "None"
        : id === "fade"
          ? uiLang === "ar"
            ? "تلاشي"
            : "Fade"
          : id === "slide-up"
            ? uiLang === "ar"
              ? "انزلاق لأعلى"
              : "Slide up"
            : id === "slide-down"
              ? uiLang === "ar"
                ? "انزلاق لأسفل"
                : "Slide down"
              : id === "slide-left"
                ? uiLang === "ar"
                  ? "انزلاق لليسار"
                  : "Slide left"
                : id === "slide-right"
                  ? uiLang === "ar"
                    ? "انزلاق لليمين"
                    : "Slide right"
                  : id === "scale"
                    ? uiLang === "ar"
                      ? "تكبير"
                      : "Scale"
                    : id === "float"
                      ? uiLang === "ar"
                        ? "طفو"
                        : "Float"
                      : id === "blur-in"
                        ? uiLang === "ar"
                          ? "ضباب"
                          : "Blur in"
                        : id === "bounce-in"
                          ? uiLang === "ar"
                            ? "ارتداد"
                            : "Bounce"
                          : id === "zoom-fade"
                            ? uiLang === "ar"
                              ? "تكبير مع تلاشي"
                              : "Zoom fade"
                            : id,
  }));

  function updateAt(index: number, patch: Partial<MotionTimelineStep>) {
    const next = steps.map((s, i) => (i === index ? { ...s, ...patch } : s));
    onChange(next);
  }

  function move(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= steps.length) return;
    const next = steps.slice();
    const tmp = next[index];
    next[index] = next[j];
    next[j] = tmp;
    onChange(next);
  }

  return (
    <div className="space-y-2 rounded-2xl border border-[var(--border)] p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
            {t("timelineTitle")}
          </div>
          <p className="mt-1 text-[10px] leading-4 text-[var(--muted)]">{t("timelineHelp")}</p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-full bg-teal-800 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-teal-700"
          onClick={() =>
            onChange([
              ...steps,
              createTimelineStep({
                trigger: steps.some((s) => s.trigger === "load") ? "scroll" : "load",
                anim: "fade",
                delayMs: 0,
                durationMs: 600,
              }),
            ])
          }
        >
          {t("timelineAddStep")}
        </button>
      </div>

      {steps.length > 0 ? (
        <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2.5" data-sf-no-space-pan="">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
              {t("timelinePreview")}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="rounded-full bg-teal-800 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-teal-700"
                onClick={() => {
                  if (playing) {
                    setPlaying(false);
                  } else {
                    if (previewT >= 0.999) setPreviewT(0);
                    setPlaying(true);
                  }
                }}
              >
                {playing ? t("timelinePause") : t("timelinePlay")}
              </button>
              <button
                type="button"
                className="rounded-full border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-[10px] font-bold text-[var(--muted)]"
                onClick={() => {
                  setPlaying(false);
                  setPreviewT(0);
                  applyMotionPreviewToDom(blockId, null);
                }}
              >
                {t("timelineReset")}
              </button>
            </div>
          </div>
          <label className="flex items-center gap-2 text-[10px] text-[var(--muted)]">
            <span className="shrink-0 font-mono tabular-nums" dir="ltr">
              {previewT.toFixed(2)}
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={previewT}
              data-sf-no-space-pan=""
              onChange={(e) => {
                setPlaying(false);
                setPreviewT(Number(e.target.value) || 0);
              }}
              className="h-2 w-full accent-[var(--accent)]"
            />
          </label>
          <p className="text-[10px] leading-4 text-[var(--muted)]">{t("timelinePreviewHelp")}</p>
        </div>
      ) : null}

      {steps.length > 0 ? (
        <MotionGraphTimeline
          steps={steps}
          selectedStepId={activeStepId}
          onSelectStep={setSelectedStepId}
          onChangeDelay={(id, delayMs) => {
            onChange(steps.map((s) => (s.id === id ? { ...s, delayMs } : s)));
          }}
          onChangeKeyframes={(id, keys) => {
            onChange(steps.map((s) => (s.id === id ? { ...s, keyframes: keys } : s)));
          }}
          onSelectKeyframe={(_id, kt) => setSelectedKeyframeT(kt)}
          selectedKeyframeT={selectedKeyframeT}
          playheadT={previewT}
          uiLang={uiLang}
        />
      ) : null}

      {steps.length === 0 ? (
        <p className="text-[11px] text-[var(--muted)]">{t("timelineEmpty")}</p>
      ) : (
        <ul className="space-y-2">
          {steps.map((step, index) => (
            <li
              key={step.id}
              className={`space-y-2 rounded-xl border p-2.5 ${
                activeStepId === step.id
                  ? "border-teal-600/50 bg-teal-50/50 dark:border-teal-500/40 dark:bg-teal-950/30"
                  : "border-[var(--border)] bg-[var(--surface)]  "
              }`}
              onClick={() => setSelectedStepId(step.id)}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800 dark:text-teal-300">
                  {t("timelineStep")} {index + 1}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="rounded-lg px-1.5 py-0.5 text-[10px] font-semibold text-[var(--muted)] hover:bg-[var(--surface)]"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                  >
                    {t("timelineMoveUp")}
                  </button>
                  <button
                    type="button"
                    className="rounded-lg px-1.5 py-0.5 text-[10px] font-semibold text-[var(--muted)] hover:bg-[var(--surface)]"
                    onClick={() => move(index, 1)}
                    disabled={index === steps.length - 1}
                  >
                    {t("timelineMoveDown")}
                  </button>
                  <button
                    type="button"
                    className="rounded-lg px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/40"
                    onClick={() => onChange(steps.filter((_, i) => i !== index))}
                  >
                    {t("timelineRemoveStep")}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-[var(--muted)]">{t("timelineTrigger")}</Label>
                  <Select
                    value={step.trigger}
                    onValueChange={(v) => updateAt(index, { trigger: v as MotionTrigger })}
                    options={[
                      { value: "load", label: t("timelineTriggerLoad") },
                      { value: "scroll", label: t("timelineTriggerScroll") },
                      { value: "hover", label: t("timelineTriggerHover") },
                    ]}
                    triggerClassName="h-8 rounded-xl text-xs font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-[var(--muted)]">{t("timelineAnim")}</Label>
                  <Select
                    value={step.anim}
                    onValueChange={(v) => updateAt(index, { anim: v })}
                    options={animOptions}
                    triggerClassName="h-8 rounded-xl text-xs font-semibold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] text-[var(--muted)]">{motionLabel("animEase", uiLang)}</Label>
                <p className="text-[10px] leading-4 text-[var(--muted)]">{t("easeHelp")}</p>
                <BezierEaseEditor
                  value={step.ease || "ease-out"}
                  onChange={(ease) => updateAt(index, { ease })}
                  uiLang={uiLang}
                />
              </div>

              <NumField
                label={motionLabel("animDuration", uiLang)}
                value={String(step.durationMs)}
                onChange={(v) => updateAt(index, { durationMs: Number(v) || 600 })}
                min={100}
                max={2000}
                step={50}
                hint="ms"
              />
              <NumField
                label={motionLabel("animDelay", uiLang)}
                value={String(step.delayMs)}
                onChange={(v) => updateAt(index, { delayMs: Number(v) || 0 })}
                min={0}
                max={1500}
                step={50}
                hint="ms"
              />

              <div className="space-y-1.5 rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] p-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
                      {t("keyframesTitle")}
                    </div>
                    <p className="mt-0.5 text-[10px] leading-4 text-[var(--muted)]">{t("keyframesHelp")}</p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded-full bg-[var(--accent)] px-2 py-1 text-[10px] font-bold text-[var(--accent-fg)]"
                    onClick={() => {
                      const existing = normalizeKeyframes(step.keyframes) || [];
                      const seed =
                        existing.length >= 2
                          ? existing
                          : defaultEntranceKeyframes(step.anim || "fade");
                      const nextT = existing.length ? Math.min(1, (existing[existing.length - 1]?.t ?? 0) + 0.25) : 0.5;
                      const next = [...seed, { t: nextT, opacity: 1 }].sort((a, b) => a.t - b.t);
                      updateAt(index, { keyframes: next });
                      setSelectedKeyframeT(nextT);
                    }}
                  >
                    {t("keyframesAdd")}
                  </button>
                </div>
                {(normalizeKeyframes(step.keyframes) || []).length === 0 ? (
                  <p className="text-[10px] text-[var(--muted)]">{t("keyframesEmpty")}</p>
                ) : (
                  <ul className="space-y-1.5">
                    {(normalizeKeyframes(step.keyframes) || []).map((k, ki) => {
                      const keys = normalizeKeyframes(step.keyframes) || [];
                      const patchKey = (pk: Partial<MotionKeyframe>) => {
                        const next = keys.map((kk, j) => (j === ki ? { ...kk, ...pk } : kk));
                        updateAt(index, { keyframes: next });
                      };
                      return (
                        <li
                          key={`${step.id}-kf-${ki}`}
                          className={`grid grid-cols-3 gap-1 rounded-lg border p-1.5 ${
                            selectedKeyframeT != null && Math.abs(selectedKeyframeT - k.t) < 0.001
                              ? "border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_8%,var(--card))]"
                              : "border-[var(--border)]"
                          }`}
                          onClick={() => setSelectedKeyframeT(k.t)}
                        >
                          <label className="space-y-0.5 text-[9px] font-bold text-[var(--foreground)]">
                            t
                            <Input
                              className="h-7 rounded-lg text-[11px]"
                              type="number"
                              min={0}
                              max={1}
                              step={0.05}
                              value={k.t}
                              onChange={(e) => patchKey({ t: Number(e.target.value) })}
                            />
                          </label>
                          <label className="space-y-0.5 text-[9px] font-bold text-[var(--foreground)]">
                            opacity
                            <Input
                              className="h-7 rounded-lg text-[11px]"
                              type="number"
                              min={0}
                              max={1}
                              step={0.05}
                              value={k.opacity ?? ""}
                              placeholder="—"
                              onChange={(e) =>
                                patchKey({
                                  opacity: e.target.value === "" ? undefined : Number(e.target.value),
                                })
                              }
                            />
                          </label>
                          <label className="space-y-0.5 text-[9px] font-bold text-[var(--foreground)]">
                            y
                            <Input
                              className="h-7 rounded-lg text-[11px]"
                              type="number"
                              step={1}
                              value={k.y ?? ""}
                              placeholder="—"
                              onChange={(e) =>
                                patchKey({ y: e.target.value === "" ? undefined : Number(e.target.value) })
                              }
                            />
                          </label>
                          <label className="space-y-0.5 text-[9px] font-bold text-[var(--foreground)]">
                            x
                            <Input
                              className="h-7 rounded-lg text-[11px]"
                              type="number"
                              step={1}
                              value={k.x ?? ""}
                              placeholder="—"
                              onChange={(e) =>
                                patchKey({ x: e.target.value === "" ? undefined : Number(e.target.value) })
                              }
                            />
                          </label>
                          <label className="space-y-0.5 text-[9px] font-bold text-[var(--foreground)]">
                            scale
                            <Input
                              className="h-7 rounded-lg text-[11px]"
                              type="number"
                              min={0}
                              max={8}
                              step={0.05}
                              value={k.scale ?? ""}
                              placeholder="—"
                              onChange={(e) =>
                                patchKey({
                                  scale: e.target.value === "" ? undefined : Number(e.target.value),
                                })
                              }
                            />
                          </label>
                          <label className="space-y-0.5 text-[9px] font-bold text-[var(--foreground)]">
                            rotate
                            <Input
                              className="h-7 rounded-lg text-[11px]"
                              type="number"
                              step={1}
                              value={k.rotate ?? ""}
                              placeholder="—"
                              onChange={(e) =>
                                patchKey({
                                  rotate: e.target.value === "" ? undefined : Number(e.target.value),
                                })
                              }
                            />
                          </label>
                          <button
                            type="button"
                            className="col-span-3 rounded-lg px-2 py-1 text-[10px] font-semibold text-rose-700 hover:bg-rose-50 dark:text-rose-300"
                            onClick={() => {
                              const next = keys.filter((_, j) => j !== ki);
                              updateAt(index, { keyframes: next.length ? next : undefined });
                            }}
                          >
                            {t("timelineRemoveStep")}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {step.trigger === "load" && index === steps.findIndex((s) => s.trigger === "load") ? (
                <div className="space-y-1.5 rounded-xl border border-dashed border-[var(--border)] p-2">
                  <Label className="text-[10px] text-[var(--muted)]">{t("timelineStaggerOnStep")}</Label>
                  <Select
                    value={step.staggerChildren ? "true" : "false"}
                    onValueChange={(v) =>
                      updateAt(index, {
                        staggerChildren: v === "true",
                        staggerMs: step.staggerMs ?? 80,
                      })
                    }
                    options={[
                      { value: "false", label: uiLang === "ar" ? "إيقاف" : "Off" },
                      { value: "true", label: uiLang === "ar" ? "تشغيل" : "On" },
                    ]}
                    triggerClassName="h-8 rounded-xl text-xs font-semibold"
                  />
                  {step.staggerChildren ? (
                    <NumField
                      label={motionLabel("staggerMs", uiLang)}
                      value={String(step.staggerMs ?? 80)}
                      onChange={(v) => updateAt(index, { staggerMs: Number(v) || 80 })}
                      min={40}
                      max={400}
                      step={20}
                      hint="ms"
                    />
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export { setLocalized };