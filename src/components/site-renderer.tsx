"use client";

import type { CSSProperties, MouseEvent as ReactMouseEvent } from "react";
import type { Block, DesignTokens, SiteContent } from "@/lib/design";
import {
  localizeProps,
  parseCsv,
  parseFooterColumns,
  parsePipeItems,
  tokensForRender,
  resolveNavItems,
  resolveLocalized,
  type BlockPart,
} from "@/lib/design";
import {
  ensureFeatureItems,
  ensureFooterColumns,
  ensurePricingPlans,
  ensureTestimonials,
  ensureFaqItems,
  ensureFormFields,
  getPartStyles,
} from "@/lib/block-parts";
import { blockFrameStyle, blockMotionAttrs, resolveBlockHref, strProp, sanitizeBlockCss } from "@/lib/block-style";
import { MotionBlock } from "@/components/motion-block";
import { PublicForm } from "@/components/public-form";
import { CollectionListView } from "@/components/collection-list-view";
import { ActionableControl } from "@/components/public-http-action";
import { usePlatformLangOptional } from "@/components/platform-lang-provider";

function str(p: Record<string, unknown>, key: string, fallback = ""): string {
  const v = p[key];
  return typeof v === "string" ? v : fallback;
}

function num(p: Record<string, unknown>, key: string, fallback: number): number {
  const v = p[key];
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return fallback;
}

function SectionShell({
  tokens,
  children,
  surface,
  id,
  className = "",
}: {
  tokens: DesignTokens;
  children: React.ReactNode;
  surface?: boolean;
  id?: string;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={`px-5 md:px-8 ${className}`}
      style={{
        paddingTop: tokens.spacing.sectionY,
        paddingBottom: tokens.spacing.sectionY,
        background: surface ? tokens.colors.surface : undefined,
      }}
    >
      <div className="mx-auto w-full" style={{ maxWidth: tokens.spacing.contentMaxWidth }}>
        {children}
      </div>
    </section>
  );
}

const SELF_FRAMED = new Set(["navbar", "hero", "footer", "cta", "features", "stats", "pricing", "testimonials", "faq", "gallery", "contact", "form", "collectionList"]);

function partRing(active: boolean) {
  return active ? "outline outline-2 outline-offset-2 outline-teal-500/80 rounded-md" : "rounded-md";
}

function pickPart(editable: boolean | undefined, onSelectPart: ((part: BlockPart | null) => void) | undefined, part: BlockPart) {
  return (e: ReactMouseEvent) => {
    if (!editable || !onSelectPart) return;
    e.preventDefault();
    e.stopPropagation();
    onSelectPart(part);
  };
}

function partStyleCSS(ps: { textColor?: string; fontSize?: string } | undefined): CSSProperties {
  if (!ps) return {};
  const s: CSSProperties = {};
  if (ps.textColor) s.color = ps.textColor;
  if (ps.fontSize) s.fontSize = /px|rem|em|%/.test(ps.fontSize) ? ps.fontSize : `${ps.fontSize}px`;
  return s;
}

function BlockView({
  block,
  tokens,
  siteSlug,
  rawProps,
  frameStyle,
  editable,
  selectedPart,
  onSelectPart,
  locale = "ar",
  fallbackLocale = "ar",
}: {
  block: Block;
  tokens: DesignTokens;
  siteSlug?: string;
  rawProps?: Record<string, unknown>;
  frameStyle?: Record<string, string | number>;
  editable?: boolean;
  selectedPart?: BlockPart | null;
  onSelectPart?: (part: BlockPart | null) => void;
  locale?: string;
  fallbackLocale?: string;
}) {
  const p = block.props as Record<string, unknown>;
  const source = rawProps || p;
  const linkFor = (key: string) => resolveBlockHref(p, key, siteSlug);
  const radius = tokens.radius;
  const primary = tokens.colors.primary;
  const secondary = tokens.colors.secondary;
  const muted = tokens.colors.muted;
  const accent = tokens.colors.accent;
  const bg = tokens.colors.background;
  const surface = tokens.colors.surface;

  switch (block.type) {
    case "navbar": {
      const navItems = resolveNavItems(source, locale, fallbackLocale);
      const items =
        navItems.length > 0
          ? navItems
          : parseCsv(p.links).map((label, i) => ({
              id: `csv-${i}`,
              label,
              href: "#",
              linkMode: "url",
              linkPageSlug: "",
              styles: undefined as undefined | { textColor?: string; fontSize?: string },
            }));
      const ctaLabel = str(p, "ctaLabel");
      const sticky = str(source, "sticky") === "true";
      const userBg = str(source, "bgColor");
      const userText = str(source, "textColor");
      const linkColor = userText || tokens.colors.text;
      const selectPart = (part: BlockPart) => (e: ReactMouseEvent) => {
        if (!editable || !onSelectPart) return;
        e.preventDefault();
        e.stopPropagation();
        onSelectPart(part);
      };
      const navStyle: CSSProperties = {
        background: userBg || surface,
        borderColor: `${secondary}12`,
        color: linkColor,
        ...(frameStyle as CSSProperties),
      };
      // frameStyle may set background/color — prefer explicit user tokens already merged in frameStyle
      if (!userBg && !(frameStyle && "background" in frameStyle)) navStyle.background = surface;
      if (userText) navStyle.color = userText;

      return (
        <nav
          className={`flex items-center justify-between gap-4 px-5 md:px-8 py-4 border-b ${
            sticky ? "sticky top-0 z-30 backdrop-blur-md" : ""
          }`}
          style={navStyle}
          data-sf-block="navbar"
        >
          <div
            role={editable ? "button" : undefined}
            tabIndex={editable ? 0 : undefined}
            className={`text-lg font-bold tracking-tight text-start ${editable ? `cursor-pointer ${partRing(selectedPart === "brand")}` : ""}`}
            style={{
              color: getPartStyles(source, "brand").textColor || userText || primary,
              fontFamily: tokens.fonts.heading,
              ...partStyleCSS(getPartStyles(source, "brand")),
            }}
            onClick={selectPart("brand")}
          >
            {str(p, "brand", "Brand")}
          </div>
          <div className="hidden sm:flex flex-wrap items-center gap-5 text-sm" style={{ color: linkColor }}>
            {items.map((item) => {
              const part = `link:${item.id}` as BlockPart;
              const linkPs = item.styles || getPartStyles(source, part);
              const hrefProps =
                item.linkMode === "page"
                  ? resolveBlockHref(
                      { ...p, linkMode: "page", linkPageSlug: item.linkPageSlug, href: item.href },
                      "href",
                      siteSlug
                    )
                  : { href: item.href || "#" };
              const linkClass = `opacity-80 hover:opacity-100 transition-opacity ${editable ? `cursor-pointer ${partRing(selectedPart === part)}` : ""}`;
              const linkStyle = {
                color: linkPs.textColor || linkColor,
                background: "transparent",
                border: 0,
                padding: 0,
                font: "inherit",
                ...partStyleCSS(linkPs),
              } as CSSProperties;
              return editable ? (
                <button
                  key={item.id}
                  type="button"
                  className={linkClass}
                  style={linkStyle}
                  onClick={selectPart(part)}
                >
                  {item.label}
                </button>
              ) : (
                <a key={item.id} className={linkClass} style={linkStyle} {...hrefProps}>
                  {item.label}
                </a>
              );
            })}
            {ctaLabel ? (
              editable ? (
                <button
                  type="button"
                  onClick={selectPart("cta")}
                  className={`inline-flex items-center px-3.5 py-1.5 text-white text-xs font-semibold ${partRing(selectedPart === "cta")}`}
                  style={{ background: primary, borderRadius: radius, color: "#fff" }}
                >
                  {ctaLabel}
                </button>
              ) : (
                <ActionableControl
                  siteSlug={siteSlug}
                  blockId={block.id}
                  props={source}
                  hrefKey="ctaHref"
                  className="inline-flex items-center px-3.5 py-1.5 text-white text-xs font-semibold"
                  style={{ background: primary, borderRadius: radius }}
                >
                  {ctaLabel}
                </ActionableControl>
              )
            ) : null}
          </div>
        </nav>
      );
    }

    case "hero": {
      const align = str(p, "align", "center");
      const textAlign = align === "start" ? "start" : align === "end" ? "end" : "center";
      const mx = textAlign === "center" ? "mx-auto" : "";
      const userBg = str(source, "bgColor");
      const userText = str(source, "textColor");
      const heroStyle: CSSProperties = {
        paddingTop: tokens.spacing.sectionY * 1.15,
        paddingBottom: tokens.spacing.sectionY * 1.15,
        textAlign: textAlign as "center",
        background: userBg
          ? userBg
          : `radial-gradient(1200px 500px at 50% -10%, ${primary}18, transparent), linear-gradient(180deg, ${surface}, ${bg})`,
        color: userText || undefined,
        ...(frameStyle as CSSProperties),
      };
      if (userBg) heroStyle.background = userBg;
      const pick = (part: BlockPart) => (e: ReactMouseEvent) => {
        if (!editable || !onSelectPart) return;
        e.preventDefault();
        e.stopPropagation();
        onSelectPart(part);
      };
      return (
        <section
          className="px-5 md:px-8 relative overflow-hidden"
          style={heroStyle}
          data-sf-block="hero"
        >
          <div className="mx-auto relative" style={{ maxWidth: tokens.spacing.contentMaxWidth }}>
            {str(p, "showBadge") !== "false" && str(p, "eyebrow") ? (
              <div
                role={editable ? "button" : undefined}
                tabIndex={editable ? 0 : undefined}
                onClick={pick("eyebrow")}
                className={`inline-flex mb-5 px-3 py-1 text-xs font-semibold tracking-wide ${mx} ${editable ? `cursor-pointer ${partRing(selectedPart === "eyebrow")}` : ""}`}
                style={{
                  color: primary,
                  background: `${primary}14`,
                  borderRadius: 999,
                  border: `1px solid ${primary}22`,
                }}
              >
                {str(p, "eyebrow")}
              </div>
            ) : null}
            <h1
              role={editable ? "button" : undefined}
              tabIndex={editable ? 0 : undefined}
              onClick={pick("headline")}
              className={`text-4xl md:text-5xl lg:text-[3.25rem] font-bold leading-[1.15] mb-5 tracking-tight ${mx} max-w-3xl ${editable ? `cursor-pointer ${partRing(selectedPart === "headline")}` : ""}`}
              style={{
                color: getPartStyles(source, "headline").textColor || userText || secondary,
                fontFamily: tokens.fonts.heading,
                ...partStyleCSS(getPartStyles(source, "headline")),
              }}
            >
              {str(p, "headline")}
            </h1>
            <p
              role={editable ? "button" : undefined}
              tabIndex={editable ? 0 : undefined}
              onClick={pick("subheadline")}
              className={`text-lg md:text-xl mb-9 max-w-2xl leading-8 ${mx} ${editable ? `cursor-pointer ${partRing(selectedPart === "subheadline")}` : ""}`}
              style={{ color: userText ? `${userText}cc` : muted }}
            >
              {str(p, "subheadline")}
            </p>
            <div className={`flex flex-wrap gap-3 ${textAlign === "center" ? "justify-center" : textAlign === "end" ? "justify-end" : "justify-start"}`}>
              {str(p, "ctaLabel") ? (
                editable ? (
                  <button
                    type="button"
                    onClick={pick("cta")}
                    className={`inline-flex items-center px-6 py-3 text-white font-semibold shadow-lg shadow-black/10 ${partRing(selectedPart === "cta")}`}
                    style={{ background: primary, borderRadius: radius }}
                  >
                    {str(p, "ctaLabel")}
                  </button>
                ) : (
                  <ActionableControl
                    siteSlug={siteSlug}
                    blockId={block.id}
                    props={source}
                    hrefKey="ctaHref"
                    className="inline-flex items-center px-6 py-3 text-white font-semibold shadow-lg shadow-black/10"
                    style={{ background: primary, borderRadius: radius }}
                  >
                    {str(p, "ctaLabel")}
                  </ActionableControl>
                )
              ) : null}
              {str(p, "secondaryLabel") ? (
                editable ? (
                  <button
                    type="button"
                    onClick={pick("secondary")}
                    className={`inline-flex items-center px-6 py-3 font-semibold border ${partRing(selectedPart === "secondary")}`}
                    style={{
                      color: userText || secondary,
                      borderColor: `${secondary}22`,
                      background: bg,
                      borderRadius: radius,
                    }}
                  >
                    {str(p, "secondaryLabel")}
                  </button>
                ) : (
                  <a
                    {...linkFor("secondaryHref")}
                    className="inline-flex items-center px-6 py-3 font-semibold border"
                    style={{
                      color: secondary,
                      borderColor: `${secondary}22`,
                      background: bg,
                      borderRadius: radius,
                    }}
                  >
                    {str(p, "secondaryLabel")}
                  </a>
                )
              ) : null}
            </div>
          </div>
        </section>
      );
    }

    case "features": {
      const structured = ensureFeatureItems(source, [locale, fallbackLocale]);
      const items =
        structured.length > 0
          ? structured.map((it) => ({
              id: it.id,
              title: resolveLocalized(it.title, locale, fallbackLocale),
              body: resolveLocalized(it.body, locale, fallbackLocale),
            }))
          : parsePipeItems(p.items).map((it, i) => ({ id: `csv-${i}`, ...it }));
      const cols = str(p, "columns", "3");
      const grid =
        cols === "2" ? "md:grid-cols-2" : cols === "4" ? "md:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-3";
      const userBg = str(source, "bgColor");
      const userText = str(source, "textColor");
      const pick = (part: BlockPart) => (e: ReactMouseEvent) => {
        if (!editable || !onSelectPart) return;
        e.preventDefault();
        e.stopPropagation();
        onSelectPart(part);
      };
      const hasPad = Boolean(str(source, "paddingY") || str(source, "paddingTop") || str(source, "paddingBottom"));
      const sectionStyle: CSSProperties = {
        paddingTop: hasPad ? undefined : tokens.spacing.sectionY,
        paddingBottom: hasPad ? undefined : tokens.spacing.sectionY,
        background: userBg || surface,
        color: userText || undefined,
        ...(frameStyle as CSSProperties),
      };
      if (userBg) sectionStyle.background = userBg;
      return (
        <section
          className="px-5 md:px-8"
          style={sectionStyle}
          data-sf-block="features"
        >
          <div className="mx-auto w-full" style={{ maxWidth: tokens.spacing.contentMaxWidth }}>
            <div className="text-center mb-10">
              <h2
                role={editable ? "button" : undefined}
                onClick={pick("title")}
                className={`text-2xl md:text-3xl font-bold mb-2 ${editable ? `cursor-pointer ${partRing(selectedPart === "title")}` : ""}`}
                style={{ color: userText || secondary, fontFamily: tokens.fonts.heading }}
              >
                {str(p, "title")}
              </h2>
              {str(p, "subtitle") ? (
                <p
                  role={editable ? "button" : undefined}
                  onClick={pick("subtitle")}
                  className={`text-sm md:text-base ${editable ? `cursor-pointer ${partRing(selectedPart === "subtitle")}` : ""}`}
                  style={{ color: muted }}
                >
                  {str(p, "subtitle")}
                </p>
              ) : null}
            </div>
            <div className={`grid gap-4 ${grid}`} style={{ gap: tokens.spacing.blockGap }}>
              {items.map((it, i) => {
                const part = `item:${it.id}` as BlockPart;
                return (
                  <div
                    key={it.id}
                    role={editable ? "button" : undefined}
                    onClick={pick(part)}
                    className={`p-6 border transition-shadow hover:shadow-md text-start ${editable ? `cursor-pointer ${partRing(selectedPart === part)}` : ""}`}
                    style={{
                      background: bg,
                      borderColor: `${secondary}10`,
                      borderRadius: radius,
                    }}
                  >
                    <div
                      className="mb-4 h-9 w-9 flex items-center justify-center text-sm font-bold text-white"
                      style={{ background: primary, borderRadius: Math.max(8, radius / 2) }}
                    >
                      {i + 1}
                    </div>
                    <div className="font-semibold mb-2 text-base" style={{ color: secondary }}>
                      {it.title}
                    </div>
                    <p className="text-sm leading-7" style={{ color: muted }}>
                      {it.body}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      );
    }

    case "gallery": {
      const structured = ensureFeatureItems(source, [locale, fallbackLocale]);
      const items =
        structured.length > 0
          ? structured.map((it) => ({
              id: it.id,
              title: resolveLocalized(it.title, locale, fallbackLocale),
              body: resolveLocalized(it.body, locale, fallbackLocale),
            }))
          : parsePipeItems(p.items).map((it, i) => ({ id: `csv-${i}`, ...it }));
      const cols = str(p, "columns", "3");
      const grid = cols === "2" ? "md:grid-cols-2" : cols === "4" ? "md:grid-cols-4" : "md:grid-cols-3";
      const pick = pickPart(editable, onSelectPart, "title" as BlockPart);
      const pickSub = pickPart(editable, onSelectPart, "subtitle");
      return (
        <SectionShell tokens={tokens}>
          <div className="text-center mb-10">
            <h2
              role={editable ? "button" : undefined}
              onClick={pick}
              className={`text-2xl md:text-3xl font-bold mb-2 ${editable ? `cursor-pointer ${partRing(selectedPart === "title")}` : ""}`}
              style={{ color: secondary, fontFamily: tokens.fonts.heading }}
            >
              {str(p, "title")}
            </h2>
            {str(p, "subtitle") ? (
              <p
                role={editable ? "button" : undefined}
                onClick={pickSub}
                className={editable ? `cursor-pointer ${partRing(selectedPart === "subtitle")}` : undefined}
                style={{ color: muted }}
              >
                {str(p, "subtitle")}
              </p>
            ) : null}
          </div>
          <div className={`grid gap-4 ${grid}`}>
            {items.map((it, i) => {
              const part = `item:${it.id}` as BlockPart;
              return (
                <div
                  key={it.id}
                  role={editable ? "button" : undefined}
                  onClick={pickPart(editable, onSelectPart, part)}
                  className={`group relative aspect-[4/3] overflow-hidden flex items-end p-4 ${editable ? `cursor-pointer ${partRing(selectedPart === part)}` : ""}`}
                  style={{
                    borderRadius: radius,
                    background: `linear-gradient(155deg, ${primary}${i % 2 ? "66" : "44"}, ${secondary}ee)`,
                  }}
                >
                  <div className="relative z-10 text-white">
                    <div className="font-semibold">{it.title}</div>
                    {it.body ? <div className="text-xs opacity-80 mt-0.5">{it.body}</div> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </SectionShell>
      );
    }

    case "pricing": {
      const structured = ensurePricingPlans(source, [locale, fallbackLocale]);
      const plans =
        structured.length > 0
          ? structured.map((plan) => ({
              id: plan.id,
              name: resolveLocalized(plan.name, locale, fallbackLocale),
              price: resolveLocalized(plan.price, locale, fallbackLocale),
              features: resolveLocalized(plan.features, locale, fallbackLocale)
                .split("|")
                .map((x) => x.trim())
                .filter(Boolean),
              ctaLabel: resolveLocalized(plan.ctaLabel, locale, fallbackLocale) || "ابدأ الآن",
              highlighted: plan.highlighted,
            }))
          : [];
      return (
        <SectionShell tokens={tokens} surface>
          <div className="text-center mb-10">
            <h2
              role={editable ? "button" : undefined}
              onClick={pickPart(editable, onSelectPart, "title")}
              className={`text-2xl md:text-3xl font-bold mb-2 ${editable ? `cursor-pointer ${partRing(selectedPart === "title")}` : ""}`}
              style={{ color: secondary, fontFamily: tokens.fonts.heading }}
            >
              {str(p, "title")}
            </h2>
            {str(p, "subtitle") ? (
              <p
                role={editable ? "button" : undefined}
                onClick={pickPart(editable, onSelectPart, "subtitle")}
                className={editable ? `cursor-pointer ${partRing(selectedPart === "subtitle")}` : undefined}
                style={{ color: muted }}
              >
                {str(p, "subtitle")}
              </p>
            ) : null}
          </div>
          <div className="grid md:grid-cols-3 gap-4 items-stretch">
            {plans.map((plan) => {
              const part = `item:${plan.id}` as BlockPart;
              return (
                <div
                  key={plan.id}
                  role={editable ? "button" : undefined}
                  onClick={pickPart(editable, onSelectPart, part)}
                  className={`p-6 border flex flex-col ${editable ? `cursor-pointer ${partRing(selectedPart === part)}` : ""}`}
                  style={{
                    background: plan.highlighted ? secondary : bg,
                    color: plan.highlighted ? "#fff" : secondary,
                    borderColor: plan.highlighted ? secondary : `${secondary}12`,
                    borderRadius: radius,
                    boxShadow: plan.highlighted ? `0 18px 40px ${secondary}33` : undefined,
                    transform: plan.highlighted ? "scale(1.02)" : undefined,
                  }}
                >
                  {plan.highlighted ? (
                    <div
                      className="self-start text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 mb-3"
                      style={{ background: accent, color: secondary, borderRadius: 999 }}
                    >
                      الأكثر شعبية
                    </div>
                  ) : null}
                  <div className="font-semibold text-lg mb-1">{plan.name}</div>
                  <div className="text-3xl font-bold mb-5" style={{ color: plan.highlighted ? accent : primary }}>
                    {plan.price}
                  </div>
                  <ul className="space-y-2.5 text-sm flex-1 mb-6 opacity-90">
                    {plan.features.map((f) => (
                      <li key={f} className="flex gap-2">
                        <span style={{ color: plan.highlighted ? accent : primary }}>✓</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <div
                    className="text-center py-2.5 text-sm font-semibold"
                    style={{
                      background: plan.highlighted ? accent : primary,
                      color: plan.highlighted ? secondary : "#fff",
                      borderRadius: radius / 1.5,
                    }}
                  >
                    {plan.ctaLabel}
                  </div>
                </div>
              );
            })}
          </div>
        </SectionShell>
      );
    }

    case "testimonials": {
      const structured = ensureTestimonials(source, [locale, fallbackLocale]);
      const items =
        structured.length > 0
          ? structured.map((it) => ({
              id: it.id,
              name: resolveLocalized(it.name, locale, fallbackLocale),
              role: resolveLocalized(it.role, locale, fallbackLocale),
              quote: resolveLocalized(it.quote, locale, fallbackLocale),
            }))
          : [];
      return (
        <SectionShell tokens={tokens}>
          <h2
            role={editable ? "button" : undefined}
            onClick={pickPart(editable, onSelectPart, "title")}
            className={`text-2xl md:text-3xl font-bold mb-10 text-center ${editable ? `cursor-pointer ${partRing(selectedPart === "title")}` : ""}`}
            style={{ color: secondary, fontFamily: tokens.fonts.heading }}
          >
            {str(p, "title")}
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            {items.map((it) => {
              const part = `item:${it.id}` as BlockPart;
              return (
                <blockquote
                  key={it.id}
                  role={editable ? "button" : undefined}
                  onClick={pickPart(editable, onSelectPart, part)}
                  className={`p-6 border flex flex-col ${editable ? `cursor-pointer ${partRing(selectedPart === part)}` : ""}`}
                  style={{
                    background: surface,
                    borderColor: `${secondary}10`,
                    borderRadius: radius,
                  }}
                >
                  <p className="text-sm leading-7 flex-1 mb-5" style={{ color: tokens.colors.text }}>
                    “{it.quote}”
                  </p>
                  <div>
                    <div className="font-semibold text-sm" style={{ color: secondary }}>
                      {it.name}
                    </div>
                    {it.role ? (
                      <div className="text-xs mt-0.5" style={{ color: muted }}>
                        {it.role}
                      </div>
                    ) : null}
                  </div>
                </blockquote>
              );
            })}
          </div>
        </SectionShell>
      );
    }

    case "faq": {
      const structured = ensureFaqItems(source, [locale, fallbackLocale]);
      const items =
        structured.length > 0
          ? structured.map((it) => ({
              id: it.id,
              q: resolveLocalized(it.q, locale, fallbackLocale),
              a: resolveLocalized(it.a, locale, fallbackLocale),
            }))
          : [];
      return (
        <SectionShell tokens={tokens} surface>
          <h2
            role={editable ? "button" : undefined}
            onClick={pickPart(editable, onSelectPart, "title")}
            className={`text-2xl md:text-3xl font-bold mb-8 text-center ${editable ? `cursor-pointer ${partRing(selectedPart === "title")}` : ""}`}
            style={{ color: secondary, fontFamily: tokens.fonts.heading }}
          >
            {str(p, "title")}
          </h2>
          <div className="max-w-3xl mx-auto space-y-3">
            {items.map((it, i) => {
              const part = `item:${it.id}` as BlockPart;
              return (
                <details
                  key={it.id}
                  className={`group border p-4 open:shadow-sm ${editable ? partRing(selectedPart === part) : ""}`}
                  style={{ background: bg, borderColor: `${secondary}12`, borderRadius: radius }}
                  open={i === 0}
                  onClick={
                    editable
                      ? (e) => {
                          e.stopPropagation();
                          onSelectPart?.(part);
                        }
                      : undefined
                  }
                >
                  <summary
                    className="font-semibold cursor-pointer list-none flex justify-between gap-3"
                    style={{ color: secondary }}
                  >
                    <span>{it.q}</span>
                    <span className="opacity-40 group-open:rotate-45 transition-transform">+</span>
                  </summary>
                  <p className="mt-3 text-sm leading-7" style={{ color: muted }}>
                    {it.a}
                  </p>
                </details>
              );
            })}
          </div>
        </SectionShell>
      );
    }

    case "cta": {
      const userBg = str(source, "bgColor");
      const pick = (part: BlockPart) => (e: ReactMouseEvent) => {
        if (!editable || !onSelectPart) return;
        e.preventDefault();
        e.stopPropagation();
        onSelectPart(part);
      };
      return (
        <section
          className="px-5 md:px-8"
          style={{
            paddingTop: tokens.spacing.sectionY,
            paddingBottom: tokens.spacing.sectionY,
            ...(frameStyle as CSSProperties),
          }}
          data-sf-block="cta"
        >
          <div className="mx-auto w-full" style={{ maxWidth: tokens.spacing.contentMaxWidth }}>
            <div
              className="p-8 md:p-12 text-center text-white relative overflow-hidden"
              style={{
                background: userBg || `linear-gradient(125deg, ${primary}, ${secondary})`,
                borderRadius: radius * 1.2,
              }}
            >
              <div
                className="absolute -top-16 -left-16 h-48 w-48 rounded-full opacity-20"
                style={{ background: accent }}
              />
              <h2
                role={editable ? "button" : undefined}
                onClick={pick("title")}
                className={`text-3xl font-bold mb-3 relative ${editable ? `cursor-pointer ${partRing(selectedPart === "title")}` : ""}`}
                style={{ fontFamily: tokens.fonts.heading }}
              >
                {str(p, "title")}
              </h2>
              <p
                role={editable ? "button" : undefined}
                onClick={pick("body")}
                className={`mb-7 opacity-90 relative max-w-xl mx-auto ${editable ? `cursor-pointer ${partRing(selectedPart === "body")}` : ""}`}
              >
                {str(p, "body")}
              </p>
              {editable ? (
                <button
                  type="button"
                  onClick={pick("button")}
                  className={`inline-flex px-6 py-3 font-semibold relative ${partRing(selectedPart === "button")}`}
                  style={{ background: "#fff", color: primary, borderRadius: radius }}
                >
                  {str(p, "buttonLabel")}
                </button>
              ) : (
                <ActionableControl
                  siteSlug={siteSlug}
                  blockId={block.id}
                  props={source}
                  hrefKey="buttonHref"
                  className="inline-flex px-6 py-3 font-semibold relative"
                  style={{ background: "#fff", color: primary, borderRadius: radius }}
                >
                  {str(p, "buttonLabel")}
                </ActionableControl>
              )}
            </div>
          </div>
        </section>
      );
    }

    case "contact": {
      const pick = (part: BlockPart) => pickPart(editable, onSelectPart, part);
      return (
        <SectionShell tokens={tokens} id="contact">
          <div className="grid md:grid-cols-2 gap-8 items-start">
            <div>
              <h2
                role={editable ? "button" : undefined}
                onClick={pick("title")}
                className={`text-2xl md:text-3xl font-bold mb-2 ${editable ? `cursor-pointer ${partRing(selectedPart === "title")}` : ""}`}
                style={{ color: secondary, fontFamily: tokens.fonts.heading }}
              >
                {str(p, "title")}
              </h2>
              {str(p, "subtitle") ? (
                <p
                  role={editable ? "button" : undefined}
                  onClick={pick("subtitle")}
                  className={`mb-6 text-sm ${editable ? `cursor-pointer ${partRing(selectedPart === "subtitle")}` : ""}`}
                  style={{ color: muted }}
                >
                  {str(p, "subtitle")}
                </p>
              ) : (
                <div className="mb-6" />
              )}
              <ul className="space-y-4 text-sm" style={{ color: tokens.colors.text }}>
                <li
                  role={editable ? "button" : undefined}
                  onClick={pick("email")}
                  className={`flex gap-3 items-center ${editable ? `cursor-pointer ${partRing(selectedPart === "email")}` : ""}`}
                >
                  <span
                    className="h-9 w-9 flex items-center justify-center text-xs"
                    style={{ background: `${primary}14`, color: primary, borderRadius: radius / 2 }}
                  >
                    ✉
                  </span>
                  {str(p, "email")}
                </li>
                <li
                  role={editable ? "button" : undefined}
                  onClick={pick("phone")}
                  className={`flex gap-3 items-center ${editable ? `cursor-pointer ${partRing(selectedPart === "phone")}` : ""}`}
                >
                  <span
                    className="h-9 w-9 flex items-center justify-center text-xs"
                    style={{ background: `${primary}14`, color: primary, borderRadius: radius / 2 }}
                  >
                    ☎
                  </span>
                  {str(p, "phone")}
                </li>
                <li
                  role={editable ? "button" : undefined}
                  onClick={pick("address")}
                  className={`flex gap-3 items-center ${editable ? `cursor-pointer ${partRing(selectedPart === "address")}` : ""}`}
                >
                  <span
                    className="h-9 w-9 flex items-center justify-center text-xs"
                    style={{ background: `${primary}14`, color: primary, borderRadius: radius / 2 }}
                  >
                    ⌖
                  </span>
                  {str(p, "address")}
                </li>
              </ul>
            </div>
            <div
              className="p-5 border"
              style={{ borderRadius: radius, borderColor: `${secondary}12`, background: surface }}
            >
              <div className="text-xs mb-3 font-medium" style={{ color: muted }}>
                نموذج تواصل (معاينة)
              </div>
              <div className="space-y-3">
                <div className="h-10 bg-white border" style={{ borderRadius: radius / 2, borderColor: `${secondary}14` }} />
                <div className="h-10 bg-white border" style={{ borderRadius: radius / 2, borderColor: `${secondary}14` }} />
                <div className="h-24 bg-white border" style={{ borderRadius: radius / 2, borderColor: `${secondary}14` }} />
                <div
                  role={editable ? "button" : undefined}
                  onClick={pick("button")}
                  className={`h-10 text-white flex items-center justify-center text-sm font-semibold ${editable ? `cursor-pointer ${partRing(selectedPart === "button")}` : ""}`}
                  style={{ background: primary, borderRadius: radius / 2 }}
                >
                  {str(p, "buttonLabel", "إرسال")}
                </div>
              </div>
            </div>
          </div>
        </SectionShell>
      );
    }

    case "footer": {
      const links = parseCsv(p.links);
      const structuredCols = ensureFooterColumns(source, [locale, fallbackLocale]);
      const columns =
        structuredCols.length > 0
          ? structuredCols.map((c) => ({
              id: c.id,
              title: resolveLocalized(c.title, locale, fallbackLocale),
              links: parseCsv(resolveLocalized(c.links, locale, fallbackLocale)),
            }))
          : parseFooterColumns(p.columns).map((c, i) => ({ id: `col-${i}`, ...c }));
      const userBg = str(source, "bgColor");
      const userText = str(source, "textColor");
      const pick = (part: BlockPart) => (e: ReactMouseEvent) => {
        if (!editable || !onSelectPart) return;
        e.preventDefault();
        e.stopPropagation();
        onSelectPart(part);
      };
      const footStyle: CSSProperties = {
        background: userBg || secondary,
        color: userText || "#cbd5e1",
        borderColor: "#1e293b",
        ...(frameStyle as CSSProperties),
      };
      if (userBg) footStyle.background = userBg;
      if (userText) footStyle.color = userText;
      return (
        <footer
          className="px-5 md:px-8 py-10 border-t"
          style={footStyle}
          data-sf-block="footer"
        >
          <div className="mx-auto" style={{ maxWidth: tokens.spacing.contentMaxWidth }}>
            {columns.length > 0 ? (
              <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-8 mb-10">
                <div>
                  <div
                    role={editable ? "button" : undefined}
                    onClick={pick("brand")}
                    className={`text-white font-bold text-lg mb-2 ${editable ? `cursor-pointer ${partRing(selectedPart === "brand")}` : ""}`}
                    style={{ fontFamily: tokens.fonts.heading, color: userText || "#fff" }}
                  >
                    {str(p, "brand", "Brand")}
                  </div>
                  <p
                    role={editable ? "button" : undefined}
                    onClick={pick("text")}
                    className={`text-sm opacity-70 leading-6 ${editable ? `cursor-pointer ${partRing(selectedPart === "text")}` : ""}`}
                  >
                    {str(p, "text")}
                  </p>
                </div>
                {columns.map((col) => {
                  const part = `column:${col.id}` as BlockPart;
                  return (
                    <div
                      key={col.id}
                      role={editable ? "button" : undefined}
                      onClick={pick(part)}
                      className={editable ? `cursor-pointer ${partRing(selectedPart === part)}` : undefined}
                    >
                      <div className="text-white font-semibold text-sm mb-3" style={{ color: userText || "#fff" }}>
                        {col.title}
                      </div>
                      <ul className="space-y-2 text-sm opacity-75">
                        {col.links.map((l) => (
                          <li key={l}>{l}</li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            ) : null}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm border-t pt-6" style={{ borderColor: "#334155" }}>
              <div
                role={editable ? "button" : undefined}
                onClick={pick("text")}
                className={editable ? `cursor-pointer ${partRing(selectedPart === "text")}` : undefined}
              >
                {str(p, "text")}
              </div>
              <div className="flex gap-4 opacity-80">
                {links.map((l) => (
                  <span key={l}>{l}</span>
                ))}
              </div>
            </div>
          </div>
        </footer>
      );
    }

    case "stats": {
      const structured = ensureFeatureItems(source, [locale, fallbackLocale]);
      const items =
        structured.length > 0
          ? structured.map((it) => ({
              id: it.id,
              title: resolveLocalized(it.title, locale, fallbackLocale),
              body: resolveLocalized(it.body, locale, fallbackLocale),
            }))
          : parsePipeItems(p.items).map((it, i) => ({ id: `csv-${i}`, ...it }));
      const userBg = str(source, "bgColor");
      const userText = str(source, "textColor");
      return (
        <section
          className="px-5 md:px-8"
          style={{
            paddingTop: tokens.spacing.sectionY,
            paddingBottom: tokens.spacing.sectionY,
            background: userBg || secondary,
            color: userText || "#fff",
            ...(frameStyle as CSSProperties),
          }}
          data-sf-block="stats"
        >
          <div className="mx-auto" style={{ maxWidth: tokens.spacing.contentMaxWidth }}>
            {str(p, "title") ? (
              <h2
                role={editable ? "button" : undefined}
                onClick={pickPart(editable, onSelectPart, "title")}
                className={`text-2xl font-bold mb-8 text-center ${editable ? `cursor-pointer ${partRing(selectedPart === "title")}` : ""}`}
                style={{ fontFamily: tokens.fonts.heading }}
              >
                {str(p, "title")}
              </h2>
            ) : null}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 text-center">
              {items.map((it) => {
                const part = `item:${it.id}` as BlockPart;
                return (
                  <div
                    key={it.id}
                    role={editable ? "button" : undefined}
                    onClick={pickPart(editable, onSelectPart, part)}
                    className={editable ? `cursor-pointer ${partRing(selectedPart === part)}` : undefined}
                  >
                    <div className="text-3xl md:text-4xl font-bold" style={{ color: accent }}>
                      {it.title}
                    </div>
                    <div className="text-sm opacity-75 mt-1">{it.body}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      );
    }

    case "heading": {
      const level = str(p, "level", "h2");
      const align = str(p, "align", "start") as "start" | "center" | "end";
      const Tag = (level === "h1" ? "h1" : level === "h3" ? "h3" : "h2") as "h1" | "h2" | "h3";
      const sizes = { h1: "text-4xl md:text-5xl", h2: "text-2xl md:text-3xl", h3: "text-xl md:text-2xl" };
      return (
        <div className="px-5 md:px-8 py-6">
          <div className="mx-auto" style={{ maxWidth: tokens.spacing.contentMaxWidth, textAlign: align }}>
            <Tag className={`font-bold tracking-tight ${sizes[Tag]}`} style={{ color: secondary, fontFamily: tokens.fonts.heading }}>
              {str(p, "text", "عنوان")}
            </Tag>
          </div>
        </div>
      );
    }

    case "text": {
      const align = str(p, "align", "start") as "start" | "center" | "end";
      return (
        <div
          className="px-5 md:px-8"
          style={{
            paddingTop: tokens.spacing.sectionY / 2,
            paddingBottom: tokens.spacing.sectionY / 2,
          }}
        >
          <div className="mx-auto" style={{ maxWidth: tokens.spacing.contentMaxWidth, textAlign: align }}>
            {str(p, "title") ? (
              <h2 className="text-2xl font-bold mb-3" style={{ color: secondary, fontFamily: tokens.fonts.heading }}>
                {str(p, "title")}
              </h2>
            ) : null}
            <p className="leading-8 whitespace-pre-wrap" style={{ color: tokens.colors.text }}>
              {str(p, "body")}
            </p>
          </div>
        </div>
      );
    }

    case "image": {
      const aspect = str(p, "aspect", "16/9");
      const rounded = str(p, "rounded", "true") !== "false";
      const src = str(p, "src");
      return (
        <div className="px-5 md:px-8 py-6">
          <div className="mx-auto" style={{ maxWidth: tokens.spacing.contentMaxWidth }}>
            <div
              className="w-full overflow-hidden flex items-center justify-center relative"
              style={{
                aspectRatio: aspect.replace(":", "/"),
                borderRadius: rounded ? radius : 0,
                background: src
                  ? undefined
                  : `linear-gradient(135deg, ${primary}33, ${secondary}88)`,
              }}
            >
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt={str(p, "alt")} className="w-full h-full object-cover" />
              ) : (
                <span className="text-white/90 text-sm font-medium">{str(p, "alt", "صورة")}</span>
              )}
            </div>
            {str(p, "caption") ? (
              <p className="text-xs mt-2 text-center" style={{ color: muted }}>
                {str(p, "caption")}
              </p>
            ) : null}
          </div>
        </div>
      );
    }

    case "video": {
      const aspect = str(p, "aspect", "16/9");
      const rounded = str(p, "rounded", "true") !== "false";
      const src = str(p, "src");
      const poster = str(p, "poster");
      const showControls = str(p, "controls", "true") !== "false";
      const doAutoplay = str(p, "autoplay") === "true";
      const doLoop = str(p, "loop") === "true";
      const doMute = str(p, "muted", "true") !== "false" || doAutoplay;
      return (
        <div className="px-5 md:px-8 py-6">
          <div className="mx-auto" style={{ maxWidth: tokens.spacing.contentMaxWidth }}>
            <div
              className="w-full overflow-hidden relative bg-black/5"
              style={{
                aspectRatio: aspect.replace(":", "/"),
                borderRadius: rounded ? radius : 0,
              }}
            >
              {src ? (
                <video
                  src={src}
                  poster={poster || undefined}
                  className="w-full h-full object-cover"
                  controls={showControls}
                  autoPlay={doAutoplay}
                  loop={doLoop}
                  muted={doMute}
                  playsInline
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-sm" style={{ color: muted }}>
                  لا يوجد فيديو بعد
                </div>
              )}
            </div>
            {str(p, "caption") ? (
              <p className="text-xs mt-2 text-center" style={{ color: muted }}>
                {str(p, "caption")}
              </p>
            ) : null}
          </div>
        </div>
      );
    }

    case "button": {
      const align = str(p, "align", "start");
      const variant = str(p, "variant", "primary");
      const size = str(p, "size", "md");
      const pad = size === "sm" ? "px-4 py-2 text-sm" : size === "lg" ? "px-8 py-3.5 text-base" : "px-6 py-2.5 text-sm";
      const style =
        variant === "outline"
          ? { background: "transparent", color: primary, border: `1.5px solid ${primary}` }
          : variant === "ghost"
            ? { background: `${primary}12`, color: primary, border: "none" }
            : { background: primary, color: "#fff", border: "none" };
      return (
        <div className="px-5 md:px-8 py-3">
          <div
            className="mx-auto flex"
            style={{
              maxWidth: tokens.spacing.contentMaxWidth,
              justifyContent: align === "center" ? "center" : align === "end" ? "flex-end" : "flex-start",
            }}
          >
            <ActionableControl
              siteSlug={siteSlug}
              blockId={block.id}
              props={source}
              hrefKey="href"
              className={`inline-flex items-center font-semibold ${pad}`}
              style={{ ...style, borderRadius: radius }}
            >
              {str(p, "label", "زر")}
            </ActionableControl>
          </div>
        </div>
      );
    }

    case "spacer":
      return <div style={{ height: num(p, "height", 48) }} aria-hidden />;

    case "columns": {
      const ratio = str(p, "ratio", "50/50");
      const grid = ratio === "40/60" ? "md:grid-cols-[2fr_3fr]" : ratio === "60/40" ? "md:grid-cols-[3fr_2fr]" : "md:grid-cols-2";
      return (
        <div
          className="px-5 md:px-8"
          style={{
            paddingTop: tokens.spacing.sectionY / 1.5,
            paddingBottom: tokens.spacing.sectionY / 1.5,
          }}
        >
          <div className={`mx-auto grid gap-6 ${grid}`} style={{ maxWidth: tokens.spacing.contentMaxWidth }}>
            <div
              className="p-5 border"
              style={{ background: surface, borderColor: `${secondary}10`, borderRadius: radius }}
            >
              <h3 className="font-semibold mb-2" style={{ color: secondary }}>
                {str(p, "leftTitle")}
              </h3>
              <p className="text-sm leading-7" style={{ color: muted }}>
                {str(p, "leftBody")}
              </p>
            </div>
            <div
              className="p-5 border"
              style={{ background: surface, borderColor: `${secondary}10`, borderRadius: radius }}
            >
              <h3 className="font-semibold mb-2" style={{ color: secondary }}>
                {str(p, "rightTitle")}
              </h3>
              <p className="text-sm leading-7" style={{ color: muted }}>
                {str(p, "rightBody")}
              </p>
            </div>
          </div>
        </div>
      );
    }

    case "divider": {
      const label = str(p, "label");
      return (
        <div className="px-5 md:px-8 py-4">
          <div className="mx-auto flex items-center gap-4" style={{ maxWidth: tokens.spacing.contentMaxWidth }}>
            <div className="flex-1 h-px" style={{ background: `${secondary}18` }} />
            {label ? (
              <span className="text-xs font-medium" style={{ color: muted }}>
                {label}
              </span>
            ) : null}
            <div className="flex-1 h-px" style={{ background: `${secondary}18` }} />
          </div>
        </div>
      );
    }

    case "list": {
      const items = parseCsv(p.items);
      const style = str(p, "style", "check");
      const bullet = style === "number" ? null : style === "dot" ? "•" : "✓";
      return (
        <div className="px-5 md:px-8 py-6">
          <div className="mx-auto" style={{ maxWidth: tokens.spacing.contentMaxWidth }}>
            {str(p, "title") ? (
              <h3 className="font-semibold mb-4 text-lg" style={{ color: secondary, fontFamily: tokens.fonts.heading }}>
                {str(p, "title")}
              </h3>
            ) : null}
            <ul className="space-y-2.5">
              {items.map((it, i) => (
                <li key={`${it}-${i}`} className="flex gap-3 text-sm leading-7" style={{ color: tokens.colors.text }}>
                  <span className="font-semibold shrink-0" style={{ color: primary, minWidth: 18 }}>
                    {bullet ?? `${i + 1}.`}
                  </span>
                  <span>{it}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      );
    }

    case "form": {
      const fields = ensureFormFields(source);
      const fieldKeys = fields.map((f) => f.key).filter(Boolean);
      const pick = (part: BlockPart) => pickPart(editable, onSelectPart, part);
      return (
        <SectionShell tokens={tokens} id={`form-${block.id}`}>
          <div className="grid md:grid-cols-2 gap-8 items-start">
            <div>
              <h2
                role={editable ? "button" : undefined}
                onClick={pick("title")}
                className={`text-2xl md:text-3xl font-bold mb-2 ${editable ? `cursor-pointer ${partRing(selectedPart === "title")}` : ""}`}
                style={{ color: secondary, fontFamily: tokens.fonts.heading }}
              >
                {str(p, "title")}
              </h2>
              {str(p, "subtitle") ? (
                <p
                  role={editable ? "button" : undefined}
                  onClick={pick("subtitle")}
                  className={`mb-4 text-sm ${editable ? `cursor-pointer ${partRing(selectedPart === "subtitle")}` : ""}`}
                  style={{ color: muted }}
                >
                  {str(p, "subtitle")}
                </p>
              ) : null}
              {editable && fields.length ? (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {fields.map((f) => {
                    const part = `field:${f.id}` as BlockPart;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={pick(part)}
                        className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${partRing(selectedPart === part)}`}
                        style={{ borderColor: `${secondary}22`, color: secondary, background: surface }}
                      >
                        {resolveLocalized(f.label, locale, fallbackLocale) || f.key}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={pick("submit")}
                    className={`rounded-full px-2.5 py-1 text-[10px] font-semibold text-white ${partRing(selectedPart === "submit")}`}
                    style={{ background: primary }}
                  >
                    {str(p, "submitLabel", "إرسال")}
                  </button>
                </div>
              ) : null}
            </div>
            {siteSlug ? (
              <div
                role={editable ? "button" : undefined}
                onClick={editable ? pick("submit") : undefined}
                className={editable ? partRing(selectedPart === "submit") : undefined}
              >
                <PublicForm
                  siteSlug={siteSlug}
                  blockId={block.id}
                  fields={fieldKeys.length ? fieldKeys : ["name", "email", "message"]}
                  fieldLabels={Object.fromEntries(
                    fields.map((f) => [f.key, resolveLocalized(f.label, locale, fallbackLocale) || f.key])
                  )}
                  submitLabel={str(p, "submitLabel", "إرسال")}
                  successMessage={str(p, "successMessage", "شكراً لك!")}
                  primary={primary}
                  radius={radius}
                  muted={muted}
                  secondary={secondary}
                  surface={surface}
                  bg={bg}
                  httpActionRaw={source.httpAction}
                />
              </div>
            ) : (
              <div className="p-5 border text-sm" style={{ borderRadius: radius, borderColor: `${secondary}12`, background: surface, color: muted }}>
                معاينة النموذج — احفظ وانشر لتفعيل الإرسال على الموقع العام
                <div
                  role={editable ? "button" : undefined}
                  onClick={pick("submit")}
                  className={`mt-3 h-10 text-white flex items-center justify-center text-sm font-semibold ${editable ? `cursor-pointer ${partRing(selectedPart === "submit")}` : ""}`}
                  style={{ background: primary, borderRadius: radius / 2 }}
                >
                  {str(p, "submitLabel", "إرسال")}
                </div>
              </div>
            )}
          </div>
        </SectionShell>
      );
    }

    case "collectionList": {
      const pick = (part: BlockPart) => pickPart(editable, onSelectPart, part);
      return (
        <div>
          {editable ? (
            <div className="px-5 md:px-8 pt-6">
              <div className="mx-auto flex flex-wrap gap-1.5" style={{ maxWidth: tokens.spacing.contentMaxWidth }}>
                {(
                  [
                    ["title", str(p, "title") || "title"],
                    ["subtitle", str(p, "subtitle") || "subtitle"],
                    ["collectionSlug", str(p, "collectionSlug", "projects")],
                    ["columns", `cols:${str(p, "columns", "3")}`],
                    ["limit", `limit:${str(p, "limit", "6")}`],
                    ["cardTitleField", str(p, "cardTitleField", "title")],
                    ["cardBodyField", str(p, "cardBodyField", "summary")],
                    ["cardImageField", str(p, "cardImageField", "image")],
                    ["cardUrlField", str(p, "cardUrlField", "url")],
                  ] as [BlockPart, string][]
                ).map(([part, label]) => (
                  <button
                    key={part}
                    type="button"
                    onClick={pick(part)}
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${partRing(selectedPart === part)}`}
                    style={{ borderColor: `${secondary}22`, color: secondary, background: surface }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div
            role={editable ? "button" : undefined}
            onClick={editable ? pick("title") : undefined}
            className={editable && (selectedPart === "title" || selectedPart === "subtitle") ? partRing(true) : undefined}
          >
            <CollectionListView
              siteSlug={siteSlug || ""}
              collectionSlug={str(p, "collectionSlug", "projects")}
              title={str(p, "title")}
              subtitle={str(p, "subtitle")}
              columns={str(p, "columns", "3")}
              limit={str(p, "limit", "6")}
              cardTitleField={str(p, "cardTitleField", "title")}
              cardBodyField={str(p, "cardBodyField", "summary")}
              cardImageField={str(p, "cardImageField", "image")}
              cardUrlField={str(p, "cardUrlField", "url")}
              primary={primary}
              secondary={secondary}
              muted={muted}
              bg={bg}
              surface={surface}
              radius={radius}
              blockGap={tokens.spacing.blockGap}
              fontsHeading={tokens.fonts.heading}
            />
          </div>
        </div>
      );
    }

    default:
      return null;
  }
}

export function SiteRenderer({
  content,
  pageSlug,
  pageId,
  selectedBlockId,
  selectedPart = null,
  hoveredBlockId,
  onSelectBlock,
  onSelectPart,
  onHoverBlock,
  locale,
  colorMode = "light",
  siteSlug,
}: {
  content: SiteContent;
  pageSlug?: string;
  pageId?: string;
  selectedBlockId?: string | null;
  selectedPart?: BlockPart | null;
  hoveredBlockId?: string | null;
  onSelectBlock?: (id: string) => void;
  onSelectPart?: (blockId: string, part: BlockPart | null) => void;
  onHoverBlock?: (id: string | null) => void;
  locale?: string;
  colorMode?: "light" | "dark";
  siteSlug?: string;
}) {
  const page =
    (pageId ? content.pages.find((p) => p.id === pageId) : undefined) ||
    (pageSlug ? content.pages.find((p) => p.slug === pageSlug) : undefined) ||
    content.pages[0];
  const activeLocale = locale || content.defaultLocale || content.locales?.[0] || "ar";
  const fallbackLocale = content.defaultLocale || content.locales?.[0] || "ar";
  const tokens = tokensForRender(content.tokens, colorMode, activeLocale);
  const editable = Boolean(onSelectBlock);
  const { t } = usePlatformLangOptional();

  return (
    <div
      dir={tokens.rtl ? "rtl" : "ltr"}
      className="sf-tenant-root min-h-full transition-colors duration-300"
      data-sf-site-surface=""
      style={{
        background: tokens.colors.background,
        color: tokens.colors.text,
        fontFamily: `${tokens.fonts.body}, system-ui, sans-serif`,
        // Site tokens stay on the preview surface — never documentElement in the editor.
        ["--sf-site-bg" as string]: tokens.colors.background,
        ["--sf-site-text" as string]: tokens.colors.text,
        ["--sf-site-surface" as string]: tokens.colors.surface,
        ["--sf-site-primary" as string]: tokens.colors.primary,
      }}
    >
      {page.blocks.map((block) => {
        const selected = selectedBlockId === block.id;
        const hovered = hoveredBlockId === block.id && !selected;
        const localized: Block = {
          ...block,
          props: localizeProps(block.props as Record<string, unknown>, activeLocale, fallbackLocale),
        };
        if (strProp(block.props as Record<string, unknown>, "hidden") === "true" && !editable) {
          return null;
        }
        const frame = blockFrameStyle(block.props as Record<string, unknown>);
        const selfFramed = SELF_FRAMED.has(block.type);
        const outerFrame = selfFramed
          ? Object.fromEntries(
              Object.entries(frame).filter(([k]) =>
                ["marginTop", "marginRight", "marginBottom", "marginLeft", "opacity", "zIndex"].includes(k)
              )
            )
          : frame;
        return (
          <div
            key={block.id}
            data-block-id={block.id}
            data-sf-site-block=""
            role={editable ? "button" : undefined}
            tabIndex={editable ? 0 : undefined}
            onClick={
              editable
                ? (e) => {
                    e.stopPropagation();
                    onSelectBlock?.(block.id);
                    onSelectPart?.(block.id, null);
                  }
                : undefined
            }
            onMouseEnter={editable ? () => onHoverBlock?.(block.id) : undefined}
            onMouseLeave={editable ? () => onHoverBlock?.(null) : undefined}
            onKeyDown={
              editable
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectBlock?.(block.id);
                      onSelectPart?.(block.id, null);
                    }
                  }
                : undefined
            }
            className={
              editable
                ? `relative outline-none transition-[box-shadow,border-radius] ${
                    selected
                      ? "ring-2 ring-teal-600/80 ring-offset-0 z-10 rounded-2xl"
                      : hovered
                        ? "ring-2 ring-teal-600/35 z-[5] rounded-2xl"
                        : ""
                  }`
                : undefined
            }
          >
            {editable && selected ? (
              <div className="absolute top-3 start-3 z-20 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 text-white pointer-events-none rounded-full bg-teal-700/95 shadow-sm">
                {block.type}
                {selectedPart ? ` · ${selectedPart}` : ""}
              </div>
            ) : null}
            {(() => {
              const motion = blockMotionAttrs(block.props as Record<string, unknown>);
              const cssClass = strProp(block.props as Record<string, unknown>, "customCss")
                ? `sf-block-${block.id}`
                : "";
              return (
            <MotionBlock
              style={{ ...(outerFrame as CSSProperties), ...motion.style }}
              className={[cssClass, motion.className].filter(Boolean).join(" ") || undefined}
              scrollReveal={motion.scrollReveal}
              hasEntrance={motion.hasEntrance}
              editable={editable}
            >
              {sanitizeBlockCss(strProp(block.props as Record<string, unknown>, "customCss")) ? (
                <style
                  dangerouslySetInnerHTML={{
                    __html: `.sf-block-${block.id} { ${sanitizeBlockCss(strProp(block.props as Record<string, unknown>, "customCss"))} }`,
                  }}
                />
              ) : null}
              <BlockView
                block={localized}
                tokens={tokens}
                siteSlug={siteSlug}
                rawProps={block.props as Record<string, unknown>}
                frameStyle={selfFramed ? frame : undefined}
                editable={editable}
                selectedPart={selected ? selectedPart : null}
                onSelectPart={
                  editable
                    ? (part) => {
                        onSelectBlock?.(block.id);
                        onSelectPart?.(block.id, part);
                      }
                    : undefined
                }
                locale={activeLocale}
                fallbackLocale={fallbackLocale}
              />
            </MotionBlock>
              );
            })()}
          </div>
        );
      })}
      {page.blocks.length === 0 ? (
        <div className="flex min-h-[320px] items-center justify-center px-6 py-12">
          <div
            className="w-full max-w-sm rounded-3xl border border-dashed px-6 py-10 text-center"
            style={{
              color: tokens.colors.muted,
              borderColor: `${tokens.colors.muted}44`,
              background: `${tokens.colors.surface}88`,
            }}
          >
            <div
              className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-bold"
              style={{ background: `${tokens.colors.primary}18`, color: tokens.colors.primary }}
              aria-hidden
            >
              +
            </div>
            <p className="text-sm font-semibold" style={{ color: tokens.colors.text }}>
              {t("canvasEmptyTitle")}
            </p>
            <p className="mt-1.5 text-xs leading-5">{t("canvasEmptyBody")}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
