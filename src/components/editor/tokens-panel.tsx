"use client";

import { FONT_OPTIONS, type DesignTokens } from "@/lib/design";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { usePlatformLang } from "@/components/platform-lang-provider";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-stone-600 dark:text-[var(--muted)]">
      {children}
    </h3>
  );
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
      <Label className="text-[11px] text-stone-600 dark:text-stone-300">{label}</Label>
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
      <Label className="text-[11px] text-stone-600 dark:text-stone-300">{label}</Label>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-teal-700"
      />
    </div>
  );
}

const COLOR_KEYS = [
  ["primary", "tokenColorPrimary"],
  ["secondary", "tokenColorSecondary"],
  ["background", "tokenColorBackground"],
  ["surface", "tokenColorSurface"],
  ["text", "tokenColorText"],
  ["muted", "tokenColorMuted"],
  ["accent", "tokenColorAccent"],
] as const;

/** Live design-tokens editor — writes through content.tokens (OCP; no second token system). */
export function TokensPanel({
  tokens,
  onUpdateTokens,
}: {
  tokens: DesignTokens;
  onUpdateTokens: (path: string, value: string | number | boolean) => void;
}) {
  const { t } = usePlatformLang();
  const dark = tokens.colorsDark || tokens.colors;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-bold text-stone-900 dark:text-stone-50">{t("tokensTitle")}</h2>
        <p className="mt-1 text-[11px] leading-5 text-stone-600 dark:text-[var(--muted)]">{t("tokensHint")}</p>
      </div>

      <SectionTitle>{t("tokensLightColors")}</SectionTitle>
      <div className="grid grid-cols-2 gap-2.5">
        {COLOR_KEYS.map(([key, labelKey]) => (
          <ColorField
            key={`light-${key}`}
            label={t(labelKey)}
            value={tokens.colors[key]}
            onChange={(v) => onUpdateTokens(`colors.${key}`, v)}
          />
        ))}
      </div>

      <SectionTitle>{t("tokensDarkColors")}</SectionTitle>
      <div className="grid grid-cols-2 gap-2.5">
        {COLOR_KEYS.map(([key, labelKey]) => (
          <ColorField
            key={`dark-${key}`}
            label={t(labelKey)}
            value={dark[key]}
            onChange={(v) => onUpdateTokens(`colorsDark.${key}`, v)}
          />
        ))}
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px] text-stone-600 dark:text-stone-300">{t("fontHeading")}</Label>
        <Select
          value={tokens.fonts.heading}
          onValueChange={(v) => onUpdateTokens("fonts.heading", v)}
          options={FONT_OPTIONS.map((f) => ({ value: f, label: f }))}
          triggerClassName="h-9 rounded-xl text-xs font-semibold"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-[11px] text-stone-600 dark:text-stone-300">{t("fontBody")}</Label>
        <Select
          value={tokens.fonts.body}
          onValueChange={(v) => onUpdateTokens("fonts.body", v)}
          options={FONT_OPTIONS.map((f) => ({ value: f, label: f }))}
          triggerClassName="h-9 rounded-xl text-xs font-semibold"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-[11px] text-stone-600 dark:text-stone-300">{t("themeVisitor")}</Label>
        <Select
          value={tokens.themeMode || "system"}
          onValueChange={(v) => onUpdateTokens("themeMode", v)}
          options={[
            { value: "system", label: t("themeSystem") },
            { value: "light", label: t("themeLight") },
            { value: "dark", label: t("themeDark") },
          ]}
          triggerClassName="h-9 rounded-xl text-xs font-semibold"
        />
      </div>
      <Slider
        label={`${t("tokenSectionY")} (${tokens.spacing.sectionY}px)`}
        min={24}
        max={140}
        value={tokens.spacing.sectionY}
        onChange={(v) => onUpdateTokens("spacing.sectionY", v)}
      />
      <Slider
        label={`${t("tokenBlockGap")} (${tokens.spacing.blockGap}px)`}
        min={8}
        max={64}
        value={tokens.spacing.blockGap}
        onChange={(v) => onUpdateTokens("spacing.blockGap", v)}
      />
      <Slider
        label={`${t("tokenContentMax")} (${tokens.spacing.contentMaxWidth}px)`}
        min={720}
        max={1280}
        value={tokens.spacing.contentMaxWidth}
        onChange={(v) => onUpdateTokens("spacing.contentMaxWidth", v)}
      />
      <Slider
        label={`${t("tokenRadius")} (${tokens.radius}px)`}
        min={8}
        max={40}
        value={tokens.radius}
        onChange={(v) => onUpdateTokens("radius", v)}
      />
    </div>
  );
}
