"use client";

import {
  createNavItem,
  ensureFeatureItems,
  ensureFooterColumns,
  ensureNavItems,
  ensurePricingPlans,
  ensureTestimonials,
  ensureFaqItems,
  ensureFormFields,
  partLabel,
  writeFeatureItems,
  writeFooterColumns,
  writeNavItems,
  writePricingPlans,
  writeTestimonials,
  writeFaqItems,
  writeFormFields,
  createFeatureItem,
  createPricingPlan,
  createTestimonialItem,
  createFaqItem,
  createFormField,
  getPartStyles,
  setPartStyles,
  type FeatureItem,
  type FooterColumnItem,
  type PricingPlanItem,
  type TestimonialItem,
  type FaqItem,
  type FormFieldItem,
} from "@/lib/block-parts";
import {
  resolveLocalized,
  setLocalized,
  type Block,
  type BlockPart,
  type NavItem,
} from "@/lib/design";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] text-stone-500 dark:text-stone-400">{label}</Label>
      {children}
    </div>
  );
}

/** Minimal per-part textColor / fontSize — applied when styles visually wire in the renderer. */
function PartStyleFields({
  props,
  partKey,
  blockId,
  uiLang,
  onUpdatePropsObject,
  onNavItemStyles,
  value,
}: {
  props: Record<string, unknown>;
  partKey: string;
  blockId: string;
  uiLang: "ar" | "en";
  onUpdatePropsObject: (blockId: string, patch: Record<string, unknown>) => void;
  /** When set, write styles onto the nav item instead of partStyles map. */
  onNavItemStyles?: (textColor: string, fontSize: string) => void;
  value?: { textColor?: string; fontSize?: string };
}) {
  const ps = value || getPartStyles(props, partKey);
  const color = ps.textColor || "";
  const size = ps.fontSize || "";
  return (
    <div className="space-y-2 rounded-2xl border border-dashed border-stone-200/90 p-2.5 dark:border-stone-700">
      <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-stone-400">
        {uiLang === "ar" ? "نمط الجزء" : "Part style"}
      </div>
      <Field label={uiLang === "ar" ? "لون النص" : "Text color"}>
        <div className="flex gap-1.5">
          <Input
            type="color"
            className="h-10 w-12 rounded-xl p-1"
            value={color && color.startsWith("#") ? color : "#1c1917"}
            onChange={(e) => {
              if (onNavItemStyles) onNavItemStyles(e.target.value, size);
              else onUpdatePropsObject(blockId, setPartStyles(props, partKey, { textColor: e.target.value }));
            }}
          />
          <Input
            className="h-10 flex-1 rounded-2xl font-mono text-xs"
            dir="ltr"
            placeholder="#1c1917"
            value={color}
            onChange={(e) => {
              if (onNavItemStyles) onNavItemStyles(e.target.value, size);
              else onUpdatePropsObject(blockId, setPartStyles(props, partKey, { textColor: e.target.value }));
            }}
          />
        </div>
      </Field>
      <Field label={uiLang === "ar" ? "حجم الخط (px)" : "Font size (px)"}>
        <Input
          className="h-10 rounded-2xl font-mono text-xs"
          dir="ltr"
          placeholder="16"
          value={size}
          onChange={(e) => {
            if (onNavItemStyles) onNavItemStyles(color, e.target.value);
            else onUpdatePropsObject(blockId, setPartStyles(props, partKey, { fontSize: e.target.value }));
          }}
        />
      </Field>
    </div>
  );
}

export function SelectedPartChip({
  part,
  lang,
  onClear,
}: {
  part: BlockPart | null;
  lang: "ar" | "en";
  onClear?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-2xl border border-teal-700/25 bg-teal-50/80 px-3 py-2 dark:border-teal-400/20 dark:bg-teal-950/40">
      <div className="min-w-0">
        <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-teal-800/70 dark:text-teal-300/80">
          {lang === "ar" ? "تعديل الجزء" : "Editing part"}
        </div>
        <div className="truncate text-xs font-semibold text-teal-950 dark:text-teal-50">
          {partLabel(part, lang)}
        </div>
      </div>
      {part && onClear ? (
        <button
          type="button"
          onClick={onClear}
          className="shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold text-teal-800 hover:bg-white/70 dark:text-teal-200 dark:hover:bg-teal-900"
        >
          {lang === "ar" ? "القسم كاملاً" : "Whole block"}
        </button>
      ) : null}
    </div>
  );
}

export function AtomicContentEditor({
  block,
  part,
  editLocale,
  locales,
  pages,
  uiLang,
  onUpdateLocalizedProp,
  onUpdateProp,
  onUpdatePropsObject,
  onSelectPart,
}: {
  block: Block;
  part: BlockPart | null;
  editLocale: string;
  locales: string[];
  pages: { slug: string; title: string }[];
  uiLang: "ar" | "en";
  onUpdateLocalizedProp: (blockId: string, key: string, locale: string, value: string) => void;
  onUpdateProp: (blockId: string, key: string, value: string) => void;
  onUpdatePropsObject: (blockId: string, patch: Record<string, unknown>) => void;
  onSelectPart?: (part: BlockPart | null) => void;
}) {
  const props = block.props as Record<string, unknown>;
  const fb = locales[0] || "ar";

  if (block.type === "navbar") {
    return (
      <NavbarAtomic
        blockId={block.id}
        props={props}
        part={part}
        editLocale={editLocale}
        locales={locales}
        pages={pages}
        uiLang={uiLang}
        onUpdateLocalizedProp={onUpdateLocalizedProp}
        onUpdateProp={onUpdateProp}
        onUpdatePropsObject={onUpdatePropsObject}
        onSelectPart={onSelectPart}
      />
    );
  }

  if (block.type === "hero") {
    return (
      <HeroAtomic
        blockId={block.id}
        props={props}
        part={part}
        editLocale={editLocale}
        uiLang={uiLang}
        pages={pages}
        onUpdateLocalizedProp={onUpdateLocalizedProp}
        onUpdateProp={onUpdateProp}
        onUpdatePropsObject={onUpdatePropsObject}
      />
    );
  }

  if (block.type === "features") {
    return (
      <FeaturesAtomic
        blockId={block.id}
        props={props}
        part={part}
        editLocale={editLocale}
        locales={locales}
        uiLang={uiLang}
        onUpdateLocalizedProp={onUpdateLocalizedProp}
        onUpdatePropsObject={onUpdatePropsObject}
        onSelectPart={onSelectPart}
      />
    );
  }

  if (block.type === "footer") {
    return (
      <FooterAtomic
        blockId={block.id}
        props={props}
        part={part}
        editLocale={editLocale}
        locales={locales}
        uiLang={uiLang}
        onUpdateLocalizedProp={onUpdateLocalizedProp}
        onUpdatePropsObject={onUpdatePropsObject}
        onSelectPart={onSelectPart}
      />
    );
  }

  if (block.type === "cta") {
    const focus = part || "title";
    return (
      <div className="space-y-3">
        {(focus === "title" || !part) && (
          <Field label={uiLang === "ar" ? "العنوان" : "Title"}>
            <Input
              className="h-10 rounded-2xl"
              value={resolveLocalized(props.title, editLocale, fb)}
              onChange={(e) => onUpdateLocalizedProp(block.id, "title", editLocale, e.target.value)}
            />
          </Field>
        )}
        {(focus === "body" || !part) && (
          <Field label={uiLang === "ar" ? "النص" : "Body"}>
            <Textarea
              className="min-h-[80px] rounded-2xl"
              value={resolveLocalized(props.body, editLocale, fb)}
              onChange={(e) => onUpdateLocalizedProp(block.id, "body", editLocale, e.target.value)}
            />
          </Field>
        )}
        {(focus === "button" || !part) && (
          <>
            <Field label={uiLang === "ar" ? "نص الزر" : "Button label"}>
              <Input
                className="h-10 rounded-2xl"
                value={resolveLocalized(props.buttonLabel, editLocale, fb)}
                onChange={(e) => onUpdateLocalizedProp(block.id, "buttonLabel", editLocale, e.target.value)}
              />
            </Field>
            <Field label={uiLang === "ar" ? "رابط الزر" : "Button URL"}>
              <Input
                className="h-10 rounded-2xl font-mono text-xs"
                dir="ltr"
                value={String(props.buttonHref ?? "")}
                onChange={(e) => onUpdateProp(block.id, "buttonHref", e.target.value)}
              />
            </Field>
          </>
        )}
      </div>
    );
  }

  if (block.type === "gallery" || block.type === "stats") {
    return (
      <FeaturesAtomic
        blockId={block.id}
        props={props}
        part={part}
        editLocale={editLocale}
        locales={locales}
        uiLang={uiLang}
        onUpdateLocalizedProp={onUpdateLocalizedProp}
        onUpdatePropsObject={onUpdatePropsObject}
        onSelectPart={onSelectPart}
        hideSubtitle={block.type === "stats"}
      />
    );
  }

  if (block.type === "pricing") {
    return (
      <PricingAtomic
        blockId={block.id}
        props={props}
        part={part}
        editLocale={editLocale}
        locales={locales}
        uiLang={uiLang}
        onUpdateLocalizedProp={onUpdateLocalizedProp}
        onUpdatePropsObject={onUpdatePropsObject}
        onSelectPart={onSelectPart}
      />
    );
  }

  if (block.type === "testimonials") {
    return (
      <TestimonialsAtomic
        blockId={block.id}
        props={props}
        part={part}
        editLocale={editLocale}
        locales={locales}
        uiLang={uiLang}
        onUpdateLocalizedProp={onUpdateLocalizedProp}
        onUpdatePropsObject={onUpdatePropsObject}
        onSelectPart={onSelectPart}
      />
    );
  }

  if (block.type === "faq") {
    return (
      <FaqAtomic
        blockId={block.id}
        props={props}
        part={part}
        editLocale={editLocale}
        locales={locales}
        uiLang={uiLang}
        onUpdateLocalizedProp={onUpdateLocalizedProp}
        onUpdatePropsObject={onUpdatePropsObject}
        onSelectPart={onSelectPart}
      />
    );
  }

  if (block.type === "contact") {
    return (
      <ContactAtomic
        blockId={block.id}
        props={props}
        part={part}
        editLocale={editLocale}
        uiLang={uiLang}
        onUpdateLocalizedProp={onUpdateLocalizedProp}
        onUpdateProp={onUpdateProp}
      />
    );
  }

  if (block.type === "form") {
    return (
      <FormAtomic
        blockId={block.id}
        props={props}
        part={part}
        editLocale={editLocale}
        locales={locales}
        uiLang={uiLang}
        onUpdateLocalizedProp={onUpdateLocalizedProp}
        onUpdatePropsObject={onUpdatePropsObject}
        onSelectPart={onSelectPart}
      />
    );
  }

  if (block.type === "collectionList") {
    return (
      <CollectionListAtomic
        blockId={block.id}
        props={props}
        part={part}
        editLocale={editLocale}
        uiLang={uiLang}
        onUpdateLocalizedProp={onUpdateLocalizedProp}
        onUpdateProp={onUpdateProp}
      />
    );
  }

  return null;
}

function NavbarAtomic({
  blockId,
  props,
  part,
  editLocale,
  locales,
  pages,
  uiLang,
  onUpdateLocalizedProp,
  onUpdateProp,
  onUpdatePropsObject,
  onSelectPart,
}: {
  blockId: string;
  props: Record<string, unknown>;
  part: BlockPart | null;
  editLocale: string;
  locales: string[];
  pages: { slug: string; title: string }[];
  uiLang: "ar" | "en";
  onUpdateLocalizedProp: (blockId: string, key: string, locale: string, value: string) => void;
  onUpdateProp: (blockId: string, key: string, value: string) => void;
  onUpdatePropsObject: (blockId: string, patch: Record<string, unknown>) => void;
  onSelectPart?: (part: BlockPart | null) => void;
}) {
  const fb = locales[0] || "ar";
  const items = ensureNavItems(props, locales);

  const commitItems = (next: NavItem[]) => {
    onUpdatePropsObject(blockId, writeNavItems(props, next, locales));
  };

  const showBrand = !part || part === "brand";
  const showCta = !part || part === "cta";
  const linkId = part?.startsWith("link:") ? part.slice(5) : null;
  const showList = !part || !!linkId;

  return (
    <div className="space-y-3">
      {showBrand ? (
        <>
          <Field label={uiLang === "ar" ? "العلامة" : "Brand"}>
            <Input
              className="h-10 rounded-2xl"
              value={resolveLocalized(props.brand, editLocale, fb)}
              onChange={(e) => onUpdateLocalizedProp(blockId, "brand", editLocale, e.target.value)}
              onFocus={() => onSelectPart?.("brand")}
            />
          </Field>
          {part === "brand" ? (
            <PartStyleFields
              props={props}
              partKey="brand"
              blockId={blockId}
              uiLang={uiLang}
              onUpdatePropsObject={onUpdatePropsObject}
            />
          ) : null}
        </>
      ) : null}

      {showList ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-[11px] text-stone-500 dark:text-stone-400">
              {uiLang === "ar" ? "روابط التنقل" : "Nav links"}
            </Label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 rounded-full text-[10px]"
              onClick={() => {
                const item = createNavItem(
                  uiLang === "ar" ? { ar: "رابط جديد", en: "New link" } : { ar: "رابط جديد", en: "New link" }
                );
                commitItems([...items, item]);
                onSelectPart?.(`link:${item.id}`);
              }}
            >
              + {uiLang === "ar" ? "رابط" : "Link"}
            </Button>
          </div>
          {items
            .filter((it) => !linkId || it.id === linkId)
            .map((it, idx) => {
              const fullIdx = items.findIndex((x) => x.id === it.id);
              return (
                <div
                  key={it.id}
                  className={`space-y-2 rounded-2xl border p-2.5 ${
                    linkId === it.id
                      ? "border-teal-600/40 bg-teal-50/50 dark:bg-teal-950/30"
                      : "border-stone-200/80 dark:border-stone-800"
                  }`}
                >
                  <button
                    type="button"
                    className="text-[10px] font-bold text-stone-400"
                    onClick={() => onSelectPart?.(`link:${it.id}`)}
                  >
                    #{fullIdx + 1}
                  </button>
                  <Input
                    className="h-9 rounded-xl text-sm"
                    value={resolveLocalized(it.label, editLocale, fb)}
                    onChange={(e) => {
                      const next = items.map((x) =>
                        x.id === it.id
                          ? { ...x, label: setLocalized(x.label, editLocale, e.target.value, locales) }
                          : x
                      );
                      commitItems(next);
                    }}
                    onFocus={() => onSelectPart?.(`link:${it.id}`)}
                  />
                  <Input
                    className="h-9 rounded-xl font-mono text-[11px]"
                    dir="ltr"
                    placeholder="https:// or #"
                    value={it.href || ""}
                    onChange={(e) => {
                      commitItems(items.map((x) => (x.id === it.id ? { ...x, href: e.target.value } : x)));
                    }}
                  />
                  {linkId === it.id ? (
                    <PartStyleFields
                      props={props}
                      partKey={`link:${it.id}`}
                      blockId={blockId}
                      uiLang={uiLang}
                      onUpdatePropsObject={onUpdatePropsObject}
                      value={it.styles}
                      onNavItemStyles={(textColor, fontSize) => {
                        commitItems(
                          items.map((x) =>
                            x.id === it.id
                              ? {
                                  ...x,
                                  styles: {
                                    ...(textColor ? { textColor } : {}),
                                    ...(fontSize ? { fontSize } : {}),
                                  },
                                }
                              : x
                          )
                        );
                      }}
                    />
                  ) : null}
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 flex-1 rounded-full text-[10px]"
                      disabled={fullIdx <= 0}
                      onClick={() => {
                        const next = [...items];
                        const t = next[fullIdx - 1];
                        next[fullIdx - 1] = next[fullIdx];
                        next[fullIdx] = t;
                        commitItems(next);
                      }}
                    >
                      ↑
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 flex-1 rounded-full text-[10px]"
                      disabled={fullIdx >= items.length - 1}
                      onClick={() => {
                        const next = [...items];
                        const t = next[fullIdx + 1];
                        next[fullIdx + 1] = next[fullIdx];
                        next[fullIdx] = t;
                        commitItems(next);
                      }}
                    >
                      ↓
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 flex-1 rounded-full text-[10px] text-rose-600 dark:text-rose-400"
                      onClick={() => {
                        commitItems(items.filter((x) => x.id !== it.id));
                        onSelectPart?.(null);
                      }}
                    >
                      {uiLang === "ar" ? "حذف" : "Delete"}
                    </Button>
                  </div>
                </div>
              );
            })}
        </div>
      ) : null}

      {showCta ? (
        <div className="space-y-2 rounded-2xl border border-stone-200/80 p-2.5 dark:border-stone-800">
          <Field label={uiLang === "ar" ? "نص CTA" : "CTA label"}>
            <Input
              className="h-10 rounded-2xl"
              value={resolveLocalized(props.ctaLabel, editLocale, fb)}
              onChange={(e) => onUpdateLocalizedProp(blockId, "ctaLabel", editLocale, e.target.value)}
              onFocus={() => onSelectPart?.("cta")}
            />
          </Field>
          <Field label={uiLang === "ar" ? "رابط CTA" : "CTA URL"}>
            <Input
              className="h-10 rounded-2xl font-mono text-xs"
              dir="ltr"
              value={String(props.ctaHref ?? "")}
              onChange={(e) => onUpdateProp(blockId, "ctaHref", e.target.value)}
            />
          </Field>
          {pages.length > 0 ? (
            <Field label={uiLang === "ar" ? "أو صفحة داخلية" : "Or internal page"}>
              <Select
                value=""
                onValueChange={(slug) => {
                  if (!slug) return;
                  onUpdateProp(blockId, "ctaHref", `?p=${encodeURIComponent(slug)}`);
                  onUpdateProp(blockId, "linkMode", "url");
                }}
                options={[
                  { value: "", label: uiLang === "ar" ? "— اختر —" : "— choose —" },
                  ...pages.map((p) => ({ value: p.slug, label: p.title })),
                ]}
              />
            </Field>
          ) : null}
        </div>
      ) : null}

      {!part ? (
        <Field label={uiLang === "ar" ? "ثابت أعلى الصفحة" : "Sticky top"}>
          <Select
            value={String(props.sticky ?? "false")}
            onValueChange={(v) => onUpdateProp(blockId, "sticky", v)}
            options={[
              { value: "false", label: uiLang === "ar" ? "لا" : "No" },
              { value: "true", label: uiLang === "ar" ? "نعم" : "Yes" },
            ]}
          />
        </Field>
      ) : null}
    </div>
  );
}

function HeroAtomic({
  blockId,
  props,
  part,
  editLocale,
  uiLang,
  pages,
  onUpdateLocalizedProp,
  onUpdateProp,
  onUpdatePropsObject,
}: {
  blockId: string;
  props: Record<string, unknown>;
  part: BlockPart | null;
  editLocale: string;
  uiLang: "ar" | "en";
  pages: { slug: string; title: string }[];
  onUpdateLocalizedProp: (blockId: string, key: string, locale: string, value: string) => void;
  onUpdateProp: (blockId: string, key: string, value: string) => void;
  onUpdatePropsObject?: (blockId: string, patch: Record<string, unknown>) => void;
}) {
  const fb = "ar";
  const show = (p: BlockPart) => !part || part === p;
  return (
    <div className="space-y-3">
      {show("eyebrow") ? (
        <Field label={uiLang === "ar" ? "الشارة" : "Eyebrow"}>
          <Input
            className="h-10 rounded-2xl"
            value={resolveLocalized(props.eyebrow, editLocale, fb)}
            onChange={(e) => onUpdateLocalizedProp(blockId, "eyebrow", editLocale, e.target.value)}
          />
        </Field>
      ) : null}
      {show("headline") ? (
        <>
          <Field label={uiLang === "ar" ? "العنوان الرئيسي" : "Headline"}>
            <Textarea
              className="min-h-[72px] rounded-2xl"
              value={resolveLocalized(props.headline, editLocale, fb)}
              onChange={(e) => onUpdateLocalizedProp(blockId, "headline", editLocale, e.target.value)}
            />
          </Field>
          {part === "headline" && onUpdatePropsObject ? (
            <PartStyleFields
              props={props}
              partKey="headline"
              blockId={blockId}
              uiLang={uiLang}
              onUpdatePropsObject={onUpdatePropsObject}
            />
          ) : null}
        </>
      ) : null}
      {show("subheadline") ? (
        <Field label={uiLang === "ar" ? "العنوان الفرعي" : "Subheadline"}>
          <Textarea
            className="min-h-[72px] rounded-2xl"
            value={resolveLocalized(props.subheadline, editLocale, fb)}
            onChange={(e) => onUpdateLocalizedProp(blockId, "subheadline", editLocale, e.target.value)}
          />
        </Field>
      ) : null}
      {show("cta") ? (
        <>
          <Field label={uiLang === "ar" ? "نص CTA" : "CTA label"}>
            <Input
              className="h-10 rounded-2xl"
              value={resolveLocalized(props.ctaLabel, editLocale, fb)}
              onChange={(e) => onUpdateLocalizedProp(blockId, "ctaLabel", editLocale, e.target.value)}
            />
          </Field>
          <Field label={uiLang === "ar" ? "رابط CTA" : "CTA URL"}>
            <Input
              className="h-10 rounded-2xl font-mono text-xs"
              dir="ltr"
              value={String(props.ctaHref ?? "")}
              onChange={(e) => onUpdateProp(blockId, "ctaHref", e.target.value)}
            />
          </Field>
        </>
      ) : null}
      {show("secondary") ? (
        <>
          <Field label={uiLang === "ar" ? "الزر الثانوي" : "Secondary label"}>
            <Input
              className="h-10 rounded-2xl"
              value={resolveLocalized(props.secondaryLabel, editLocale, fb)}
              onChange={(e) => onUpdateLocalizedProp(blockId, "secondaryLabel", editLocale, e.target.value)}
            />
          </Field>
          <Field label={uiLang === "ar" ? "رابط ثانوي" : "Secondary URL"}>
            <Input
              className="h-10 rounded-2xl font-mono text-xs"
              dir="ltr"
              value={String(props.secondaryHref ?? "")}
              onChange={(e) => onUpdateProp(blockId, "secondaryHref", e.target.value)}
            />
          </Field>
        </>
      ) : null}
      {!part ? (
        <Field label={uiLang === "ar" ? "المحاذاة" : "Align"}>
          <Select
            value={String(props.align || "center")}
            onValueChange={(v) => onUpdateProp(blockId, "align", v)}
            options={[
              { value: "start", label: uiLang === "ar" ? "بداية" : "Start" },
              { value: "center", label: uiLang === "ar" ? "وسط" : "Center" },
              { value: "end", label: uiLang === "ar" ? "نهاية" : "End" },
            ]}
          />
        </Field>
      ) : null}
      {pages.length ? null : null}
    </div>
  );
}

function FeaturesAtomic({
  blockId,
  props,
  part,
  editLocale,
  locales,
  uiLang,
  onUpdateLocalizedProp,
  onUpdatePropsObject,
  onSelectPart,
  hideSubtitle = false,
}: {
  blockId: string;
  props: Record<string, unknown>;
  part: BlockPart | null;
  editLocale: string;
  locales: string[];
  uiLang: "ar" | "en";
  onUpdateLocalizedProp: (blockId: string, key: string, locale: string, value: string) => void;
  onUpdatePropsObject: (blockId: string, patch: Record<string, unknown>) => void;
  onSelectPart?: (part: BlockPart | null) => void;
  hideSubtitle?: boolean;
}) {
  const fb = locales[0] || "ar";
  const items = ensureFeatureItems(props, locales);
  const commit = (next: FeatureItem[]) => onUpdatePropsObject(blockId, writeFeatureItems(props, next, locales));
  const itemId = part?.startsWith("item:") ? part.slice(5) : null;
  const showHead = !part || part === "title" || part === "subtitle";
  const showItems = !part || !!itemId;

  return (
    <div className="space-y-3">
      {showHead && (!part || part === "title") ? (
        <Field label={uiLang === "ar" ? "العنوان" : "Title"}>
          <Input
            className="h-10 rounded-2xl"
            value={resolveLocalized(props.title, editLocale, fb)}
            onChange={(e) => onUpdateLocalizedProp(blockId, "title", editLocale, e.target.value)}
          />
        </Field>
      ) : null}
      {showHead && !hideSubtitle && (!part || part === "subtitle") ? (
        <Field label={uiLang === "ar" ? "الوصف" : "Subtitle"}>
          <Input
            className="h-10 rounded-2xl"
            value={resolveLocalized(props.subtitle, editLocale, fb)}
            onChange={(e) => onUpdateLocalizedProp(blockId, "subtitle", editLocale, e.target.value)}
          />
        </Field>
      ) : null}
      {showItems ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-[11px] text-stone-500 dark:text-stone-400">
              {uiLang === "ar" ? "العناصر" : "Items"}
            </Label>
            {!itemId ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 rounded-full text-[10px]"
                onClick={() => {
                  const it = createFeatureItem();
                  commit([...items, it]);
                  onSelectPart?.(`item:${it.id}`);
                }}
              >
                + {uiLang === "ar" ? "عنصر" : "Item"}
              </Button>
            ) : null}
          </div>
          {items
            .filter((it) => !itemId || it.id === itemId)
            .map((it) => (
              <div
                key={it.id}
                className="space-y-2 rounded-2xl border border-stone-200/80 p-2.5 dark:border-stone-800"
              >
                <Input
                  className="h-9 rounded-xl"
                  value={resolveLocalized(it.title, editLocale, fb)}
                  onChange={(e) =>
                    commit(
                      items.map((x) =>
                        x.id === it.id
                          ? { ...x, title: setLocalized(x.title, editLocale, e.target.value, locales) }
                          : x
                      )
                    )
                  }
                  onFocus={() => onSelectPart?.(`item:${it.id}`)}
                />
                <Textarea
                  className="min-h-[64px] rounded-xl text-sm"
                  value={resolveLocalized(it.body, editLocale, fb)}
                  onChange={(e) =>
                    commit(
                      items.map((x) =>
                        x.id === it.id
                          ? { ...x, body: setLocalized(x.body, editLocale, e.target.value, locales) }
                          : x
                      )
                    )
                  }
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 w-full rounded-full text-[10px] text-rose-600 dark:text-rose-400"
                  onClick={() => {
                    commit(items.filter((x) => x.id !== it.id));
                    onSelectPart?.(null);
                  }}
                >
                  {uiLang === "ar" ? "حذف العنصر" : "Delete item"}
                </Button>
              </div>
            ))}
        </div>
      ) : null}
    </div>
  );
}

function FooterAtomic({
  blockId,
  props,
  part,
  editLocale,
  locales,
  uiLang,
  onUpdateLocalizedProp,
  onUpdatePropsObject,
  onSelectPart,
}: {
  blockId: string;
  props: Record<string, unknown>;
  part: BlockPart | null;
  editLocale: string;
  locales: string[];
  uiLang: "ar" | "en";
  onUpdateLocalizedProp: (blockId: string, key: string, locale: string, value: string) => void;
  onUpdatePropsObject: (blockId: string, patch: Record<string, unknown>) => void;
  onSelectPart?: (part: BlockPart | null) => void;
}) {
  const fb = locales[0] || "ar";
  const cols = ensureFooterColumns(props, locales);
  const commit = (next: FooterColumnItem[]) =>
    onUpdatePropsObject(blockId, writeFooterColumns(props, next, locales));
  const colId = part?.startsWith("column:") ? part.slice(7) : null;

  return (
    <div className="space-y-3">
      {(!part || part === "brand") && (
        <Field label={uiLang === "ar" ? "العلامة" : "Brand"}>
          <Input
            className="h-10 rounded-2xl"
            value={resolveLocalized(props.brand, editLocale, fb)}
            onChange={(e) => onUpdateLocalizedProp(blockId, "brand", editLocale, e.target.value)}
          />
        </Field>
      )}
      {(!part || part === "text") && (
        <Field label={uiLang === "ar" ? "النص / الحقوق" : "Text / copyright"}>
          <Textarea
            className="min-h-[64px] rounded-2xl"
            value={resolveLocalized(props.text, editLocale, fb)}
            onChange={(e) => onUpdateLocalizedProp(blockId, "text", editLocale, e.target.value)}
          />
        </Field>
      )}
      {(!part || colId) && (
        <div className="space-y-2">
          <Label className="text-[11px] text-stone-500 dark:text-stone-400">
            {uiLang === "ar" ? "أعمدة الروابط" : "Link columns"}
          </Label>
          {cols
            .filter((c) => !colId || c.id === colId)
            .map((c) => (
              <div key={c.id} className="space-y-2 rounded-2xl border border-stone-200/80 p-2.5 dark:border-stone-800">
                <Input
                  className="h-9 rounded-xl"
                  value={resolveLocalized(c.title, editLocale, fb)}
                  onChange={(e) =>
                    commit(
                      cols.map((x) =>
                        x.id === c.id
                          ? { ...x, title: setLocalized(x.title, editLocale, e.target.value, locales) }
                          : x
                      )
                    )
                  }
                  onFocus={() => onSelectPart?.(`column:${c.id}`)}
                />
                <Textarea
                  className="min-h-[56px] rounded-xl text-sm font-mono"
                  dir="ltr"
                  placeholder="link1,link2"
                  value={resolveLocalized(c.links, editLocale, fb)}
                  onChange={(e) =>
                    commit(
                      cols.map((x) =>
                        x.id === c.id
                          ? { ...x, links: setLocalized(x.links, editLocale, e.target.value, locales) }
                          : x
                      )
                    )
                  }
                />
              </div>
            ))}
        </div>
      )}
    </div>
  );
}


function PricingAtomic({
  blockId,
  props,
  part,
  editLocale,
  locales,
  uiLang,
  onUpdateLocalizedProp,
  onUpdatePropsObject,
  onSelectPart,
}: {
  blockId: string;
  props: Record<string, unknown>;
  part: BlockPart | null;
  editLocale: string;
  locales: string[];
  uiLang: "ar" | "en";
  onUpdateLocalizedProp: (blockId: string, key: string, locale: string, value: string) => void;
  onUpdatePropsObject: (blockId: string, patch: Record<string, unknown>) => void;
  onSelectPart?: (part: BlockPart | null) => void;
}) {
  const fb = locales[0] || "ar";
  const plans = ensurePricingPlans(props, locales);
  const commit = (next: PricingPlanItem[]) => onUpdatePropsObject(blockId, writePricingPlans(props, next, locales));
  const itemId = part?.startsWith("item:") ? part.slice(5) : null;
  return (
    <div className="space-y-3">
      {(!part || part === "title") && (
        <Field label={uiLang === "ar" ? "العنوان" : "Title"}>
          <Input
            className="h-10 rounded-2xl"
            value={resolveLocalized(props.title, editLocale, fb)}
            onChange={(e) => onUpdateLocalizedProp(blockId, "title", editLocale, e.target.value)}
          />
        </Field>
      )}
      {(!part || part === "subtitle") && (
        <Field label={uiLang === "ar" ? "الوصف" : "Subtitle"}>
          <Input
            className="h-10 rounded-2xl"
            value={resolveLocalized(props.subtitle, editLocale, fb)}
            onChange={(e) => onUpdateLocalizedProp(blockId, "subtitle", editLocale, e.target.value)}
          />
        </Field>
      )}
      {(!part || itemId) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-[11px] text-stone-500 dark:text-stone-400">
              {uiLang === "ar" ? "الخطط" : "Plans"}
            </Label>
            {!itemId ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 rounded-full text-[10px]"
                onClick={() => {
                  const it = createPricingPlan();
                  commit([...plans, it]);
                  onSelectPart?.(`item:${it.id}`);
                }}
              >
                + {uiLang === "ar" ? "خطة" : "Plan"}
              </Button>
            ) : null}
          </div>
          {plans
            .filter((it) => !itemId || it.id === itemId)
            .map((it) => (
              <div key={it.id} className="space-y-2 rounded-2xl border border-stone-200/80 p-2.5 dark:border-stone-800">
                <Input
                  className="h-9 rounded-xl"
                  placeholder={uiLang === "ar" ? "اسم الخطة" : "Plan name"}
                  value={resolveLocalized(it.name, editLocale, fb)}
                  onChange={(e) =>
                    commit(
                      plans.map((x) =>
                        x.id === it.id ? { ...x, name: setLocalized(x.name, editLocale, e.target.value, locales) } : x
                      )
                    )
                  }
                  onFocus={() => onSelectPart?.(`item:${it.id}`)}
                />
                <Input
                  className="h-9 rounded-xl"
                  placeholder={uiLang === "ar" ? "السعر" : "Price"}
                  value={resolveLocalized(it.price, editLocale, fb)}
                  onChange={(e) =>
                    commit(
                      plans.map((x) =>
                        x.id === it.id ? { ...x, price: setLocalized(x.price, editLocale, e.target.value, locales) } : x
                      )
                    )
                  }
                />
                <Textarea
                  className="min-h-[64px] rounded-xl text-sm font-mono"
                  dir="ltr"
                  placeholder="feat1|feat2|feat3"
                  value={resolveLocalized(it.features, editLocale, fb)}
                  onChange={(e) =>
                    commit(
                      plans.map((x) =>
                        x.id === it.id
                          ? { ...x, features: setLocalized(x.features, editLocale, e.target.value, locales) }
                          : x
                      )
                    )
                  }
                />
                <Input
                  className="h-9 rounded-xl"
                  placeholder={uiLang === "ar" ? "نص الزر" : "CTA label"}
                  value={resolveLocalized(it.ctaLabel, editLocale, fb)}
                  onChange={(e) =>
                    commit(
                      plans.map((x) =>
                        x.id === it.id
                          ? { ...x, ctaLabel: setLocalized(x.ctaLabel, editLocale, e.target.value, locales) }
                          : x
                      )
                    )
                  }
                />
                <Select
                  value={it.highlighted ? "true" : "false"}
                  onValueChange={(v) =>
                    commit(plans.map((x) => (x.id === it.id ? { ...x, highlighted: v === "true" } : x)))
                  }
                  options={[
                    { value: "false", label: uiLang === "ar" ? "عادية" : "Normal" },
                    { value: "true", label: uiLang === "ar" ? "مميزة / شائعة" : "Highlighted" },
                  ]}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 w-full rounded-full text-[10px] text-rose-600 dark:text-rose-400"
                  onClick={() => {
                    commit(plans.filter((x) => x.id !== it.id));
                    onSelectPart?.(null);
                  }}
                >
                  {uiLang === "ar" ? "حذف الخطة" : "Delete plan"}
                </Button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function TestimonialsAtomic({
  blockId,
  props,
  part,
  editLocale,
  locales,
  uiLang,
  onUpdateLocalizedProp,
  onUpdatePropsObject,
  onSelectPart,
}: {
  blockId: string;
  props: Record<string, unknown>;
  part: BlockPart | null;
  editLocale: string;
  locales: string[];
  uiLang: "ar" | "en";
  onUpdateLocalizedProp: (blockId: string, key: string, locale: string, value: string) => void;
  onUpdatePropsObject: (blockId: string, patch: Record<string, unknown>) => void;
  onSelectPart?: (part: BlockPart | null) => void;
}) {
  const fb = locales[0] || "ar";
  const items = ensureTestimonials(props, locales);
  const commit = (next: TestimonialItem[]) => onUpdatePropsObject(blockId, writeTestimonials(props, next, locales));
  const itemId = part?.startsWith("item:") ? part.slice(5) : null;
  return (
    <div className="space-y-3">
      {(!part || part === "title") && (
        <Field label={uiLang === "ar" ? "العنوان" : "Title"}>
          <Input
            className="h-10 rounded-2xl"
            value={resolveLocalized(props.title, editLocale, fb)}
            onChange={(e) => onUpdateLocalizedProp(blockId, "title", editLocale, e.target.value)}
          />
        </Field>
      )}
      {(!part || itemId) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-[11px] text-stone-500 dark:text-stone-400">
              {uiLang === "ar" ? "الشهادات" : "Quotes"}
            </Label>
            {!itemId ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 rounded-full text-[10px]"
                onClick={() => {
                  const it = createTestimonialItem();
                  commit([...items, it]);
                  onSelectPart?.(`item:${it.id}`);
                }}
              >
                + {uiLang === "ar" ? "شهادة" : "Quote"}
              </Button>
            ) : null}
          </div>
          {items
            .filter((it) => !itemId || it.id === itemId)
            .map((it) => (
              <div key={it.id} className="space-y-2 rounded-2xl border border-stone-200/80 p-2.5 dark:border-stone-800">
                <Textarea
                  className="min-h-[72px] rounded-xl text-sm"
                  value={resolveLocalized(it.quote, editLocale, fb)}
                  onChange={(e) =>
                    commit(
                      items.map((x) =>
                        x.id === it.id ? { ...x, quote: setLocalized(x.quote, editLocale, e.target.value, locales) } : x
                      )
                    )
                  }
                  onFocus={() => onSelectPart?.(`item:${it.id}`)}
                />
                <Input
                  className="h-9 rounded-xl"
                  placeholder={uiLang === "ar" ? "الاسم" : "Name"}
                  value={resolveLocalized(it.name, editLocale, fb)}
                  onChange={(e) =>
                    commit(
                      items.map((x) =>
                        x.id === it.id ? { ...x, name: setLocalized(x.name, editLocale, e.target.value, locales) } : x
                      )
                    )
                  }
                />
                <Input
                  className="h-9 rounded-xl"
                  placeholder={uiLang === "ar" ? "الدور" : "Role"}
                  value={resolveLocalized(it.role, editLocale, fb)}
                  onChange={(e) =>
                    commit(
                      items.map((x) =>
                        x.id === it.id ? { ...x, role: setLocalized(x.role, editLocale, e.target.value, locales) } : x
                      )
                    )
                  }
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 w-full rounded-full text-[10px] text-rose-600 dark:text-rose-400"
                  onClick={() => {
                    commit(items.filter((x) => x.id !== it.id));
                    onSelectPart?.(null);
                  }}
                >
                  {uiLang === "ar" ? "حذف" : "Delete"}
                </Button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function FaqAtomic({
  blockId,
  props,
  part,
  editLocale,
  locales,
  uiLang,
  onUpdateLocalizedProp,
  onUpdatePropsObject,
  onSelectPart,
}: {
  blockId: string;
  props: Record<string, unknown>;
  part: BlockPart | null;
  editLocale: string;
  locales: string[];
  uiLang: "ar" | "en";
  onUpdateLocalizedProp: (blockId: string, key: string, locale: string, value: string) => void;
  onUpdatePropsObject: (blockId: string, patch: Record<string, unknown>) => void;
  onSelectPart?: (part: BlockPart | null) => void;
}) {
  const fb = locales[0] || "ar";
  const items = ensureFaqItems(props, locales);
  const commit = (next: FaqItem[]) => onUpdatePropsObject(blockId, writeFaqItems(props, next, locales));
  const itemId = part?.startsWith("item:") ? part.slice(5) : null;
  return (
    <div className="space-y-3">
      {(!part || part === "title") && (
        <Field label={uiLang === "ar" ? "العنوان" : "Title"}>
          <Input
            className="h-10 rounded-2xl"
            value={resolveLocalized(props.title, editLocale, fb)}
            onChange={(e) => onUpdateLocalizedProp(blockId, "title", editLocale, e.target.value)}
          />
        </Field>
      )}
      {(!part || itemId) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-[11px] text-stone-500 dark:text-stone-400">
              {uiLang === "ar" ? "الأسئلة" : "Questions"}
            </Label>
            {!itemId ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 rounded-full text-[10px]"
                onClick={() => {
                  const it = createFaqItem();
                  commit([...items, it]);
                  onSelectPart?.(`item:${it.id}`);
                }}
              >
                + {uiLang === "ar" ? "سؤال" : "Q"}
              </Button>
            ) : null}
          </div>
          {items
            .filter((it) => !itemId || it.id === itemId)
            .map((it) => (
              <div key={it.id} className="space-y-2 rounded-2xl border border-stone-200/80 p-2.5 dark:border-stone-800">
                <Input
                  className="h-9 rounded-xl"
                  value={resolveLocalized(it.q, editLocale, fb)}
                  onChange={(e) =>
                    commit(
                      items.map((x) =>
                        x.id === it.id ? { ...x, q: setLocalized(x.q, editLocale, e.target.value, locales) } : x
                      )
                    )
                  }
                  onFocus={() => onSelectPart?.(`item:${it.id}`)}
                />
                <Textarea
                  className="min-h-[64px] rounded-xl text-sm"
                  value={resolveLocalized(it.a, editLocale, fb)}
                  onChange={(e) =>
                    commit(
                      items.map((x) =>
                        x.id === it.id ? { ...x, a: setLocalized(x.a, editLocale, e.target.value, locales) } : x
                      )
                    )
                  }
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 w-full rounded-full text-[10px] text-rose-600 dark:text-rose-400"
                  onClick={() => {
                    commit(items.filter((x) => x.id !== it.id));
                    onSelectPart?.(null);
                  }}
                >
                  {uiLang === "ar" ? "حذف" : "Delete"}
                </Button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function ContactAtomic({
  blockId,
  props,
  part,
  editLocale,
  uiLang,
  onUpdateLocalizedProp,
  onUpdateProp,
}: {
  blockId: string;
  props: Record<string, unknown>;
  part: BlockPart | null;
  editLocale: string;
  uiLang: "ar" | "en";
  onUpdateLocalizedProp: (blockId: string, key: string, locale: string, value: string) => void;
  onUpdateProp: (blockId: string, key: string, value: string) => void;
}) {
  const fb = "ar";
  const show = (p: BlockPart) => !part || part === p;
  return (
    <div className="space-y-3">
      {show("title") ? (
        <Field label={uiLang === "ar" ? "العنوان" : "Title"}>
          <Input
            className="h-10 rounded-2xl"
            value={resolveLocalized(props.title, editLocale, fb)}
            onChange={(e) => onUpdateLocalizedProp(blockId, "title", editLocale, e.target.value)}
          />
        </Field>
      ) : null}
      {show("subtitle") ? (
        <Field label={uiLang === "ar" ? "الوصف" : "Subtitle"}>
          <Input
            className="h-10 rounded-2xl"
            value={resolveLocalized(props.subtitle, editLocale, fb)}
            onChange={(e) => onUpdateLocalizedProp(blockId, "subtitle", editLocale, e.target.value)}
          />
        </Field>
      ) : null}
      {show("email") ? (
        <Field label={uiLang === "ar" ? "البريد" : "Email"}>
          <Input
            className="h-10 rounded-2xl font-mono text-xs"
            dir="ltr"
            value={resolveLocalized(props.email, editLocale, fb) || String(props.email ?? "")}
            onChange={(e) => onUpdateProp(blockId, "email", e.target.value)}
          />
        </Field>
      ) : null}
      {show("phone") ? (
        <Field label={uiLang === "ar" ? "الهاتف" : "Phone"}>
          <Input
            className="h-10 rounded-2xl"
            dir="ltr"
            value={resolveLocalized(props.phone, editLocale, fb) || String(props.phone ?? "")}
            onChange={(e) => onUpdateProp(blockId, "phone", e.target.value)}
          />
        </Field>
      ) : null}
      {show("address") ? (
        <Field label={uiLang === "ar" ? "العنوان" : "Address"}>
          <Input
            className="h-10 rounded-2xl"
            value={resolveLocalized(props.address, editLocale, fb)}
            onChange={(e) => onUpdateLocalizedProp(blockId, "address", editLocale, e.target.value)}
          />
        </Field>
      ) : null}
      {show("button") ? (
        <Field label={uiLang === "ar" ? "نص الزر" : "Button"}>
          <Input
            className="h-10 rounded-2xl"
            value={resolveLocalized(props.buttonLabel, editLocale, fb)}
            onChange={(e) => onUpdateLocalizedProp(blockId, "buttonLabel", editLocale, e.target.value)}
          />
        </Field>
      ) : null}
    </div>
  );
}

function FormAtomic({
  blockId,
  props,
  part,
  editLocale,
  locales,
  uiLang,
  onUpdateLocalizedProp,
  onUpdatePropsObject,
  onSelectPart,
}: {
  blockId: string;
  props: Record<string, unknown>;
  part: BlockPart | null;
  editLocale: string;
  locales: string[];
  uiLang: "ar" | "en";
  onUpdateLocalizedProp: (blockId: string, key: string, locale: string, value: string) => void;
  onUpdatePropsObject: (blockId: string, patch: Record<string, unknown>) => void;
  onSelectPart?: (part: BlockPart | null) => void;
}) {
  const fb = locales[0] || "ar";
  const fields = ensureFormFields(props);
  const commit = (next: FormFieldItem[]) => onUpdatePropsObject(blockId, writeFormFields(props, next));
  const fieldId = part?.startsWith("field:") ? part.slice(6) : null;
  return (
    <div className="space-y-3">
      {(!part || part === "title") && (
        <Field label={uiLang === "ar" ? "العنوان" : "Title"}>
          <Input
            className="h-10 rounded-2xl"
            value={resolveLocalized(props.title, editLocale, fb)}
            onChange={(e) => onUpdateLocalizedProp(blockId, "title", editLocale, e.target.value)}
          />
        </Field>
      )}
      {(!part || part === "subtitle") && (
        <Field label={uiLang === "ar" ? "الوصف" : "Subtitle"}>
          <Input
            className="h-10 rounded-2xl"
            value={resolveLocalized(props.subtitle, editLocale, fb)}
            onChange={(e) => onUpdateLocalizedProp(blockId, "subtitle", editLocale, e.target.value)}
          />
        </Field>
      )}
      {(!part || part === "submit") && (
        <Field label={uiLang === "ar" ? "نص الإرسال" : "Submit label"}>
          <Input
            className="h-10 rounded-2xl"
            value={resolveLocalized(props.submitLabel, editLocale, fb)}
            onChange={(e) => onUpdateLocalizedProp(blockId, "submitLabel", editLocale, e.target.value)}
          />
        </Field>
      )}
      {(!part || part === "success") && (
        <Field label={uiLang === "ar" ? "رسالة النجاح" : "Success message"}>
          <Input
            className="h-10 rounded-2xl"
            value={resolveLocalized(props.successMessage, editLocale, fb)}
            onChange={(e) => onUpdateLocalizedProp(blockId, "successMessage", editLocale, e.target.value)}
          />
        </Field>
      )}
      {(!part || fieldId) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-[11px] text-stone-500 dark:text-stone-400">
              {uiLang === "ar" ? "الحقول" : "Fields"}
            </Label>
            {!fieldId ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 rounded-full text-[10px]"
                onClick={() => {
                  const it = createFormField(`field${fields.length + 1}`);
                  commit([...fields, it]);
                  onSelectPart?.(`field:${it.id}`);
                }}
              >
                + {uiLang === "ar" ? "حقل" : "Field"}
              </Button>
            ) : null}
          </div>
          {fields
            .filter((f) => !fieldId || f.id === fieldId)
            .map((f) => (
              <div key={f.id} className="space-y-2 rounded-2xl border border-stone-200/80 p-2.5 dark:border-stone-800">
                <Input
                  className="h-9 rounded-xl font-mono text-xs"
                  dir="ltr"
                  placeholder="key"
                  value={f.key}
                  onChange={(e) =>
                    commit(fields.map((x) => (x.id === f.id ? { ...x, key: e.target.value.trim() || x.key } : x)))
                  }
                  onFocus={() => onSelectPart?.(`field:${f.id}`)}
                />
                <Input
                  className="h-9 rounded-xl"
                  placeholder={uiLang === "ar" ? "التسمية" : "Label"}
                  value={resolveLocalized(f.label, editLocale, fb)}
                  onChange={(e) =>
                    commit(
                      fields.map((x) =>
                        x.id === f.id ? { ...x, label: setLocalized(x.label, editLocale, e.target.value, locales) } : x
                      )
                    )
                  }
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 w-full rounded-full text-[10px] text-rose-600 dark:text-rose-400"
                  onClick={() => {
                    commit(fields.filter((x) => x.id !== f.id));
                    onSelectPart?.(null);
                  }}
                >
                  {uiLang === "ar" ? "حذف الحقل" : "Delete field"}
                </Button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function CollectionListAtomic({
  blockId,
  props,
  part,
  editLocale,
  uiLang,
  onUpdateLocalizedProp,
  onUpdateProp,
}: {
  blockId: string;
  props: Record<string, unknown>;
  part: BlockPart | null;
  editLocale: string;
  uiLang: "ar" | "en";
  onUpdateLocalizedProp: (blockId: string, key: string, locale: string, value: string) => void;
  onUpdateProp: (blockId: string, key: string, value: string) => void;
}) {
  const fb = "ar";
  const show = (p: BlockPart) => !part || part === p;
  return (
    <div className="space-y-3">
      {show("title") ? (
        <Field label={uiLang === "ar" ? "العنوان" : "Title"}>
          <Input
            className="h-10 rounded-2xl"
            value={resolveLocalized(props.title, editLocale, fb)}
            onChange={(e) => onUpdateLocalizedProp(blockId, "title", editLocale, e.target.value)}
          />
        </Field>
      ) : null}
      {show("subtitle") ? (
        <Field label={uiLang === "ar" ? "الوصف" : "Subtitle"}>
          <Input
            className="h-10 rounded-2xl"
            value={resolveLocalized(props.subtitle, editLocale, fb)}
            onChange={(e) => onUpdateLocalizedProp(blockId, "subtitle", editLocale, e.target.value)}
          />
        </Field>
      ) : null}
      {show("collectionSlug") ? (
        <Field label={uiLang === "ar" ? "معرّف المجموعة" : "Collection slug"}>
          <Input
            className="h-10 rounded-2xl font-mono text-xs"
            dir="ltr"
            value={String(props.collectionSlug ?? "")}
            onChange={(e) => onUpdateProp(blockId, "collectionSlug", e.target.value)}
          />
        </Field>
      ) : null}
      {show("columns") ? (
        <Field label={uiLang === "ar" ? "الأعمدة" : "Columns"}>
          <Select
            value={String(props.columns || "3")}
            onValueChange={(v) => onUpdateProp(blockId, "columns", v)}
            options={[
              { value: "2", label: "2" },
              { value: "3", label: "3" },
              { value: "4", label: "4" },
            ]}
          />
        </Field>
      ) : null}
      {show("limit") ? (
        <Field label={uiLang === "ar" ? "الحد" : "Limit"}>
          <Input
            className="h-10 rounded-2xl font-mono text-xs"
            dir="ltr"
            value={String(props.limit ?? "6")}
            onChange={(e) => onUpdateProp(blockId, "limit", e.target.value)}
          />
        </Field>
      ) : null}
      {show("cardTitleField") ? (
        <Field label={uiLang === "ar" ? "حقل العنوان في البطاقة" : "Card title field"}>
          <Input
            className="h-10 rounded-2xl font-mono text-xs"
            dir="ltr"
            value={String(props.cardTitleField ?? "title")}
            onChange={(e) => onUpdateProp(blockId, "cardTitleField", e.target.value)}
          />
        </Field>
      ) : null}
      {show("cardBodyField") ? (
        <Field label={uiLang === "ar" ? "حقل الوصف في البطاقة" : "Card body field"}>
          <Input
            className="h-10 rounded-2xl font-mono text-xs"
            dir="ltr"
            value={String(props.cardBodyField ?? "summary")}
            onChange={(e) => onUpdateProp(blockId, "cardBodyField", e.target.value)}
          />
        </Field>
      ) : null}
      {show("cardImageField") ? (
        <Field label={uiLang === "ar" ? "حقل الصورة في البطاقة" : "Card image field"}>
          <Input
            className="h-10 rounded-2xl font-mono text-xs"
            dir="ltr"
            value={String(props.cardImageField ?? "image")}
            onChange={(e) => onUpdateProp(blockId, "cardImageField", e.target.value)}
          />
        </Field>
      ) : null}
      {show("cardUrlField") ? (
        <Field label={uiLang === "ar" ? "حقل الرابط في البطاقة" : "Card URL field"}>
          <Input
            className="h-10 rounded-2xl font-mono text-xs"
            dir="ltr"
            value={String(props.cardUrlField ?? "url")}
            onChange={(e) => onUpdateProp(blockId, "cardUrlField", e.target.value)}
          />
        </Field>
      ) : null}
    </div>
  );
}

export const ATOMIC_BLOCK_TYPES = new Set([
  "navbar",
  "hero",
  "features",
  "footer",
  "cta",
  "pricing",
  "testimonials",
  "faq",
  "gallery",
  "stats",
  "contact",
  "form",
  "collectionList",
]);

