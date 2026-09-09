"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BLOCK_META,
  LOCALE_CODES,
  LOCALE_META,
  cloneBlock,
  defaultPropsFor,
  isLocaleCode,
  localeDir,
  setLocalized,
  slugifyPage,
  type Block,
  type BlockPart,
  type BlockType,
  type LocaleCode,
  type SiteContent,
} from "@/lib/design";
import { listBlockParts } from "@/lib/block-parts";
import { withEditableDefaults } from "@/lib/block-style";
import { SiteRenderer } from "@/components/site-renderer";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { InsertPalette } from "@/components/editor/insert-palette";
import { InspectorPanel } from "@/components/editor/inspector-panel";
import { SiteSettingsPanel, type SiteSettings, type SiteSettingsFocus } from "@/components/editor/site-settings-panel";
import { CollectionsPanel } from "@/components/editor/collections-panel";
import { SubmissionsPanel } from "@/components/editor/submissions-panel";
import { MediaField } from "@/components/editor/media-field";
import { CommandPalette, type CommandItem } from "@/components/command-palette";
import { useEditorHistory } from "@/hooks/use-editor-history";
import { ThemeToggleButton } from "@/components/theme-provider";
import { PlatformLangSwitcher, usePlatformLang } from "@/components/platform-lang-provider";
import { nanoid } from "nanoid";
import {
  LEFT_COLLAPSED_KEY,
  RIGHT_COLLAPSED_KEY,
  readCollapsedPref,
  writeCollapsedPref,
} from "@/lib/editor-prefs";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  MoreHorizontal,
  FilePlus2,
  Languages,
  Layers,
  Monitor,
  Moon,
  Plus,
  Redo2,
  Save,
  Settings2,
  Smartphone,
  Sun,
  Tablet,
  Trash2,
  Undo2,
  Upload,
  PanelLeft,
  PanelRight,
  X,
  Library,
  BookmarkPlus,
  Search,
  Globe,
  KeyRound,
} from "lucide-react";

type SiteMeta = {
  id: string;
  name: string;
  slug: string;
  publishedAt: string | null;
  seoTitle?: string;
  seoDescription?: string;
  ogImage?: string;
  favicon?: string;
  customCss?: string;
  customDomain?: string;
  domainStatus?: "none" | "pending" | "active" | "error";
};
type LeftTab = "insert" | "layers" | "pages" | "langs" | "cms";
type RightTab = "inspect" | "site" | "replies";
type Viewport = "mobile" | "tablet" | "laptop";

const VIEWPORT_WIDTH: Record<Viewport, number | string> = {
  mobile: 390,
  tablet: 768,
  laptop: "100%",
};

export function EditorShell({ site, initialContent }: { site: SiteMeta; initialContent: SiteContent }) {
  const { lang: uiLang, dir: uiDir, t } = usePlatformLang();
  const { content, commit, undo, redo, canUndo, canRedo } = useEditorHistory(initialContent);
  const [pageId, setPageId] = useState(initialContent.pages[0]?.id ?? "");
  const [selectedId, setSelectedId] = useState<string | null>(initialContent.pages[0]?.blocks[0]?.id ?? null);
  const [selectedPart, setSelectedPart] = useState<BlockPart | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [leftTab, setLeftTab] = useState<LeftTab>("insert");
  const [viewport, setViewport] = useState<Viewport>("laptop");
  const [previewMode, setPreviewMode] = useState<"light" | "dark">("light");
  const [editLocale, setEditLocale] = useState(initialContent.defaultLocale || "ar");
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [pageTitleDraft, setPageTitleDraft] = useState("");
  const [settings, setSettings] = useState<SiteSettings>({
    name: site.name,
    seoTitle: site.seoTitle || "",
    seoDescription: site.seoDescription || "",
    ogImage: site.ogImage || "",
    favicon: site.favicon || "",
    customCss: site.customCss || "",
    customDomain: site.customDomain || "",
    domainStatus: site.domainStatus || "none",
  });
  const [rightTab, setRightTab] = useState<RightTab>("inspect");
  const [siteFocus, setSiteFocus] = useState<SiteSettingsFocus>(null);
  const [siteFocusNonce, setSiteFocusNonce] = useState(0);
  const [mobilePanel, setMobilePanel] = useState<"none" | "left" | "right">("none");
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [publishedAt, setPublishedAt] = useState<string | null>(site.publishedAt);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "dirty">("saved");
  const autosaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipDirtyRef = useRef(true);
  const moreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLeftCollapsed(readCollapsedPref(LEFT_COLLAPSED_KEY));
    setRightCollapsed(readCollapsedPref(RIGHT_COLLAPSED_KEY));
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!moreRef.current) return;
      if (!moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function toggleLeftCollapsed() {
    setLeftCollapsed((v) => {
      const next = !v;
      writeCollapsedPref(LEFT_COLLAPSED_KEY, next);
      return next;
    });
  }
  function toggleRightCollapsed() {
    setRightCollapsed((v) => {
      const next = !v;
      writeCollapsedPref(RIGHT_COLLAPSED_KEY, next);
      return next;
    });
  }

  const pageIndex = Math.max(0, content.pages.findIndex((p) => p.id === pageId));
  const page = content.pages[pageIndex] ?? content.pages[0];
  const locales = useMemo(
    () => (content.locales?.length ? content.locales : [content.defaultLocale || "ar"]),
    [content.locales, content.defaultLocale]
  );
  const pageTitle = page?.title;
  const pageStableId = page?.id;

  useEffect(() => {
    if (!content.pages.find((p) => p.id === pageId) && content.pages[0]) setPageId(content.pages[0].id);
  }, [content.pages, pageId]);

  useEffect(() => {
    if (pageTitle != null) setPageTitleDraft(pageTitle);
  }, [pageStableId, pageTitle]);

  useEffect(() => {
    if (!locales.includes(editLocale)) setEditLocale(locales[0]);
  }, [locales, editLocale]);

  useEffect(() => {
    if (skipDirtyRef.current) {
      skipDirtyRef.current = false;
      return;
    }
    setSaveState("dirty");
  }, [content, settings]);

  const selected = useMemo(() => page?.blocks.find((b) => b.id === selectedId) || null, [page?.blocks, selectedId]);

  const selectBlock = useCallback((id: string | null) => {
    setSelectedId(id);
    setSelectedPart(null);
  }, []);

  const selectTarget = useCallback((blockId: string, part: BlockPart | null) => {
    setSelectedId(blockId);
    setSelectedPart(part);
  }, []);

  const updatePageBlocks = useCallback(
    (updater: (blocks: Block[]) => Block[]) => {
      commit((prev) => ({
        ...prev,
        pages: prev.pages.map((p) => (p.id === page.id ? { ...p, blocks: updater(p.blocks) } : p)),
      }));
    },
    [commit, page?.id]
  );

  function updateTokens(path: string, value: string | number | boolean) {
    commit((prev) => {
      const tokens = structuredClone(prev.tokens);
      if (!tokens.colorsDark) tokens.colorsDark = structuredClone(prev.tokens.colors);
      const [group, key] = path.split(".");
      if (group === "colors" && key) (tokens.colors as Record<string, string>)[key] = String(value);
      else if (group === "colorsDark" && key) (tokens.colorsDark as Record<string, string>)[key] = String(value);
      else if (group === "fonts" && key) (tokens.fonts as Record<string, string>)[key] = String(value);
      else if (group === "spacing" && key) (tokens.spacing as Record<string, number>)[key] = Number(value);
      else if (path === "radius") tokens.radius = Number(value);
      else if (path === "rtl") tokens.rtl = Boolean(value);
      else if (path === "themeMode") tokens.themeMode = value as "light" | "dark" | "system";
      return { ...prev, tokens };
    });
  }

  function updateBlockProps(id: string, key: string, value: string) {
    updatePageBlocks((blocks) =>
      blocks.map((b) => (b.id === id ? { ...b, props: { ...b.props, [key]: value } } : b))
    );
  }

  function updateLocalizedProp(id: string, key: string, locale: string, value: string) {
    updatePageBlocks((blocks) =>
      blocks.map((b) => {
        if (b.id !== id) return b;
        const next = setLocalized(b.props[key], locale, value, locales);
        return { ...b, props: { ...b.props, [key]: next } };
      })
    );
  }

  function updateBlockPropsObject(id: string, patch: Record<string, unknown>) {
    updatePageBlocks((blocks) =>
      blocks.map((b) => (b.id === id ? { ...b, props: { ...b.props, ...patch } } : b))
    );
  }

  function addBlock(type: BlockType, afterId?: string | null) {
    const block: Block = { id: `b-${nanoid(8)}`, type, props: withEditableDefaults(defaultPropsFor(type)) };
    updatePageBlocks((blocks) => {
      if (!afterId) return [...blocks, block];
      const i = blocks.findIndex((b) => b.id === afterId);
      if (i < 0) return [...blocks, block];
      const next = [...blocks];
      next.splice(i + 1, 0, block);
      return next;
    });
    setSelectedId(block.id);
    setSelectedPart(null);
    setLeftTab("layers");
  }

  function duplicateBlock(id: string) {
    const src = page.blocks.find((b) => b.id === id);
    if (!src) return;
    const copy = cloneBlock(src, `b-${nanoid(8)}`);
    updatePageBlocks((blocks) => {
      const i = blocks.findIndex((b) => b.id === id);
      const next = [...blocks];
      next.splice(i + 1, 0, copy);
      return next;
    });
    setSelectedId(copy.id);
    setSelectedPart(null);
  }

  function saveAsComponent(blockId: string) {
    const src = page.blocks.find((b) => b.id === blockId);
    if (!src) return;
    const name = window.prompt("اسم القسم المحفوظ", BLOCK_META[src.type].label);
    if (!name || !name.trim()) return;
    commit((prev) => ({
      ...prev,
      components: [
        ...(prev.components || []),
        { id: `cmp-${nanoid(8)}`, name: name.trim(), blocks: [cloneBlock(src, `b-${nanoid(8)}`)] },
      ],
    }));
    setMessage(uiLang === "en" ? "Section saved" : "تم حفظ القسم");
    setLeftTab("insert");
  }

  function insertSavedComponent(componentId: string) {
    const cmp = (content.components || []).find((c) => c.id === componentId);
    if (!cmp) return;
    const clones = cmp.blocks.map((b) => cloneBlock(b, `b-${nanoid(8)}`));
    updatePageBlocks((blocks) => {
      if (!selectedId) return [...blocks, ...clones];
      const i = blocks.findIndex((b) => b.id === selectedId);
      if (i < 0) return [...blocks, ...clones];
      const next = [...blocks];
      next.splice(i + 1, 0, ...clones);
      return next;
    });
    if (clones[0]) setSelectedId(clones[0].id);
  }

  function removeSavedComponent(componentId: string) {
    commit((prev) => ({
      ...prev,
      components: (prev.components || []).filter((c) => c.id !== componentId),
    }));
  }


  function moveBlock(id: string, dir: -1 | 1) {
    updatePageBlocks((blocks) => {
      const i = blocks.findIndex((b) => b.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= blocks.length) return blocks;
      const next = [...blocks];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function removeBlock(id: string) {
    updatePageBlocks((blocks) => blocks.filter((b) => b.id !== id));
    if (selectedId === id) setSelectedPart(null);
    setSelectedId((cur) => (cur === id ? null : cur));
  }

  function reorderByDrag(targetId: string) {
    if (!dragId || dragId === targetId) return;
    updatePageBlocks((blocks) => {
      const from = blocks.findIndex((b) => b.id === dragId);
      const to = blocks.findIndex((b) => b.id === targetId);
      if (from < 0 || to < 0) return blocks;
      const next = [...blocks];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
    setDragId(null);
  }

  function addPage() {
    const id = `page-${nanoid(6)}`;
    const n = content.pages.length + 1;
    commit((prev) => ({
      ...prev,
      pages: [
        ...prev.pages,
        {
          id,
          title: `صفحة ${n}`,
          slug: slugifyPage(`page-${n}`),
          blocks: [
            { id: `b-${nanoid(8)}`, type: "heading", props: withEditableDefaults(defaultPropsFor("heading")) },
            { id: `b-${nanoid(8)}`, type: "text", props: withEditableDefaults(defaultPropsFor("text")) },
          ],
        },
      ],
    }));
    setPageId(id);
    setSelectedId(null);
    setLeftTab("pages");
  }

  function renamePage(id: string, title: string) {
    const clean = title.trim() || "صفحة";
    commit((prev) => ({
      ...prev,
      pages: prev.pages.map((p) =>
        p.id === id ? { ...p, title: clean, slug: p.slug === "home" ? "home" : slugifyPage(clean) } : p
      ),
    }));
  }

  function deletePage(id: string) {
    if (content.pages.length <= 1) return;
    commit((prev) => ({ ...prev, pages: prev.pages.filter((p) => p.id !== id) }));
    if (pageId === id) {
      const next = content.pages.find((p) => p.id !== id);
      if (next) setPageId(next.id);
    }
    setSelectedId(null);
  }

  function movePage(id: string, dir: -1 | 1) {
    commit((prev) => {
      const pages = [...prev.pages];
      const i = pages.findIndex((p) => p.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= pages.length) return prev;
      [pages[i], pages[j]] = [pages[j], pages[i]];
      return { ...prev, pages };
    });
  }

  function toggleLocale(code: LocaleCode) {
    commit((prev) => {
      const cur = prev.locales?.length ? [...prev.locales] : [prev.defaultLocale || "ar"];
      const has = cur.includes(code);
      if (has) {
        if (cur.length <= 1) return prev;
        const next = cur.filter((c) => c !== code);
        return {
          ...prev,
          locales: next,
          defaultLocale: next.includes(prev.defaultLocale) ? prev.defaultLocale : next[0],
        };
      }
      return { ...prev, locales: [...cur, code] };
    });
  }

  function updatePageSeo(id: string, patch: { seoTitle?: string; seoDescription?: string; seoOgImage?: string }) {
    commit((prev) => ({
      ...prev,
      pages: prev.pages.map((pg) => (pg.id === id ? { ...pg, ...patch } : pg)),
    }));
  }

  function setDefaultLocale(code: string) {
    commit((prev) => {
      const cur = prev.locales?.length ? prev.locales : [code];
      const locales = cur.includes(code) ? cur : [...cur, code];
      return { ...prev, locales, defaultLocale: code };
    });
  }

  async function save(publish = false) {
    if (publish) setPublishing(true);
    else setSaving(true);
    setSaveState("saving");
    setMessage("");
    try {
      const res = await fetch(`/api/sites/${site.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftContent: content,
          publish,
          name: settings.name || site.name,
          seoTitle: settings.seoTitle || null,
          seoDescription: settings.seoDescription || null,
          ogImage: settings.ogImage || null,
          favicon: settings.favicon || null,
          customCss: settings.customCss || null,
          customDomain: settings.customDomain || null,
          domainStatus: settings.domainStatus || "none",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessage(data.error || t("saveFailed"));
        setSaveState("dirty");
        return;
      }
      setMessage(publish ? t("publishedOk") : t("savedDraft"));
      setSaveState("saved");
      if (publish) setPublishedAt(new Date().toISOString());
    } finally {
      setSaving(false);
      setPublishing(false);
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if (typing) return;
      if (mod && e.key.toLowerCase() === "d" && selectedId) {
        e.preventDefault();
        duplicateBlock(selectedId);
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        removeBlock(selectedId);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, undo, redo, page?.blocks]);

  useEffect(() => {
    if (saveState !== "dirty") return;
    if (autosaveRef.current) clearTimeout(autosaveRef.current);
    autosaveRef.current = setTimeout(() => {
      save(false);
    }, 1600);
    return () => {
      if (autosaveRef.current) clearTimeout(autosaveRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, settings, saveState]);

  function openSiteSection(section: SiteSettingsFocus = null) {
    setRightCollapsed(false);
    writeCollapsedPref(RIGHT_COLLAPSED_KEY, false);
    setRightTab("site");
    setSiteFocus(section);
    setSiteFocusNonce((n) => n + 1);
    setMobilePanel("right");
  }

  const commands: CommandItem[] = [
    { id: "save", label: t("savedDraft"), action: () => save(false) },
    { id: "publish", label: t("publish"), action: () => save(true) },
    { id: "insert", label: t("cmdInsert"), action: () => setLeftTab("insert") },
    { id: "pages", label: t("cmdPages"), action: () => setLeftTab("pages") },
    { id: "settings", label: t("cmdSettings"), action: () => openSiteSection(null) },
    { id: "replies", label: t("cmdReplies"), action: () => setRightTab("replies") },
    { id: "cms", label: t("cmdCms"), action: () => setLeftTab("cms") },
    { id: "dashboard", label: t("cmdDashboard"), action: () => { window.location.href = "/dashboard"; } },
  ];

  if (!page) return null;
  const canvasWidth = VIEWPORT_WIDTH[viewport];

  return (
    <div className="sf-canvas flex h-screen flex-col" dir={uiDir} lang={uiLang} data-sf-chrome="platform">
      <CommandPalette items={commands} />
      <header className="relative z-40 flex shrink-0 items-center gap-1.5 overflow-x-auto overflow-y-visible px-2 py-2 sm:gap-2 sm:px-3 sm:py-2.5">
        {/* 1) Nav / site identity */}
        <div className="sf-toolbar-group shrink-0 pe-1.5 ps-0.5" data-tone="nav" title={site.name}>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="rounded-full px-2 text-stone-600 focus-visible:ring-[3px] dark:text-stone-300"
            title={t("backDashboard")}
            aria-label={t("backDashboard")}
          >
            <Link href="/dashboard">
              <span className="sm:hidden" aria-hidden>←</span>
              <span className="hidden sm:inline">{t("backDashboard")}</span>
            </Link>
          </Button>
          <div className="sf-toolbar-divider hidden sm:block" aria-hidden />
          <div className="min-w-0 pe-1.5">
            <div className="max-w-[7rem] truncate text-sm font-semibold tracking-tight sm:max-w-[11rem]">{site.name}</div>
            <div className="hidden truncate font-mono text-[10px] text-stone-500 sm:block" dir="ltr">/s/{site.slug}</div>
          </div>
        </div>

        {/* 2) CONTENT — page / locale / device / undo / insert */}
        <div className="sf-toolbar-group hidden min-w-0 sm:inline-flex" data-tone="content" title={t("toolbarContentHint")}>
          <span className="sf-toolbar-label">{t("toolbarContent")}</span>
          <label className="flex items-center gap-1 ps-0.5">
            <span className="sr-only">{t("pageSelect")}</span>
            <Select
              value={pageId}
              onValueChange={(id) => {
                setPageId(id);
                setSelectedId(null);
                setSelectedPart(null);
              }}
              aria-label={t("pageSelect")}
              triggerClassName="h-8 w-auto min-w-[5.5rem] max-w-[9rem] rounded-full border-0 bg-white/80 px-2.5 text-[11px] font-bold shadow-none dark:bg-stone-950/50"
              wrapperClassName="w-auto"
              options={content.pages.map((p) => ({ value: p.id, label: p.title }))}
            />
          </label>
          <div className="sf-toolbar-divider" aria-hidden />
          <label className="flex items-center gap-1">
            <span className="sr-only">{t("contentLang")}</span>
            <Select
              value={editLocale}
              onValueChange={setEditLocale}
              aria-label={t("contentLang")}
              triggerClassName="h-8 w-auto min-w-[5.5rem] max-w-[8rem] rounded-full border-0 bg-teal-50/90 px-2.5 text-[11px] font-bold text-teal-950 shadow-none dark:bg-teal-950/45 dark:text-teal-50"
              wrapperClassName="w-auto"
              options={locales.map((code) => ({
                value: code,
                label: isLocaleCode(code) ? LOCALE_META[code].nativeLabel : code,
              }))}
            />
          </label>
          <div className="sf-toolbar-divider" aria-hidden />
          <div className="inline-flex items-center gap-0.5 rounded-full bg-white/55 p-0.5 dark:bg-stone-950/40" role="group" aria-label={t("helpViewport")}>
            {(
              [
                ["mobile", Smartphone, t("viewportMobile")],
                ["tablet", Tablet, t("viewportTablet")],
                ["laptop", Monitor, t("viewportLaptop")],
              ] as const
            ).map(([key, Icon, label]) => (
              <button
                key={key}
                type="button"
                title={label}
                aria-label={label}
                aria-pressed={viewport === key}
                onClick={() => setViewport(key)}
                className={`inline-flex items-center justify-center rounded-full p-2 text-xs transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--ring)] ${
                  viewport === key
                    ? "bg-stone-900 text-white shadow-sm dark:bg-stone-100 dark:text-stone-900"
                    : "text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setPreviewMode((m) => (m === "light" ? "dark" : "light"))}
            className="inline-flex items-center justify-center rounded-full p-2 text-xs text-stone-600 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--ring)] dark:text-stone-300"
            title={t("previewTheme")}
            aria-label={t("previewTheme")}
          >
            {previewMode === "light" ? <Sun className="h-3.5 w-3.5" aria-hidden /> : <Moon className="h-3.5 w-3.5" aria-hidden />}
          </button>
          <div className="sf-toolbar-divider hidden md:block" aria-hidden />
          <Button variant="ghost" size="icon" className="hidden h-8 w-8 rounded-full md:inline-flex" onClick={undo} disabled={!canUndo} title={t("undo")} aria-label={t("undo")}>
            <Undo2 className="h-4 w-4" aria-hidden />
          </Button>
          <Button variant="ghost" size="icon" className="hidden h-8 w-8 rounded-full md:inline-flex" onClick={redo} disabled={!canRedo} title={t("redo")} aria-label={t("redo")}>
            <Redo2 className="h-4 w-4" aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="hidden h-8 rounded-full px-2.5 text-[11px] font-bold lg:inline-flex"
            title={t("helpInsert")}
            aria-label={t("openInsert")}
            onClick={() => {
              setLeftCollapsed(false);
              writeCollapsedPref(LEFT_COLLAPSED_KEY, false);
              setLeftTab("insert");
              setMobilePanel("left");
            }}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden xl:inline">{t("openInsert")}</span>
          </Button>
        </div>

        {/* 3) SITE — settings / SEO / domain / secrets / CMS / chrome theme */}
        <div className="sf-toolbar-group hidden min-w-0 md:inline-flex" data-tone="site" title={t("toolbarSiteHint")}>
          <span className="sf-toolbar-label">{t("toolbarSite")}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 rounded-full px-2.5 text-[11px] font-bold"
            title={t("helpSite")}
            aria-label={t("openSiteSettings")}
            onClick={() => openSiteSection(null)}
          >
            <Settings2 className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden xl:inline">{t("openSiteSettings")}</span>
          </Button>
          <div className="inline-flex items-center gap-0.5 rounded-full bg-white/55 p-0.5 dark:bg-stone-950/40" role="group" aria-label={t("toolbarSite")}>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-full p-2 text-xs text-stone-600 transition hover:text-stone-900 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--ring)] dark:text-stone-300 dark:hover:text-stone-50"
              title={t("tipOpenSeo")}
              aria-label={t("openSeo")}
              onClick={() => openSiteSection("seo")}
            >
              <Search className="h-3.5 w-3.5" aria-hidden />
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-full p-2 text-xs text-stone-600 transition hover:text-stone-900 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--ring)] dark:text-stone-300 dark:hover:text-stone-50"
              title={t("tipOpenDomain")}
              aria-label={t("openDomain")}
              onClick={() => openSiteSection("domain")}
            >
              <Globe className="h-3.5 w-3.5" aria-hidden />
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-full p-2 text-xs text-stone-600 transition hover:text-stone-900 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--ring)] dark:text-stone-300 dark:hover:text-stone-50"
              title={t("tipOpenSecrets")}
              aria-label={t("openSecrets")}
              onClick={() => openSiteSection("secrets")}
            >
              <KeyRound className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 rounded-full px-2.5 text-[11px] font-bold"
            title={t("helpCms")}
            aria-label={t("openCms")}
            onClick={() => {
              setLeftCollapsed(false);
              writeCollapsedPref(LEFT_COLLAPSED_KEY, false);
              setLeftTab("cms");
              setMobilePanel("left");
            }}
          >
            <Library className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden xl:inline">{t("openCms")}</span>
          </Button>
          <div className="sf-toolbar-divider" aria-hidden />
          <div className="px-0.5" title={t("chromeTheme")}>
            <ThemeToggleButton />
          </div>
          <div className="hidden px-0.5 lg:block" title={t("appUiLangHint")}>
            <PlatformLangSwitcher size="compact" />
          </div>
        </div>

        <div className="ms-auto flex min-w-0 shrink-0 items-center gap-1.5">
          {/* 4) ACTIONS — save status / preview / publish */}
          <div className="sf-toolbar-group" data-tone="actions" title={t("toolbarActionsHint")}>
            <span className="sf-toolbar-label">{t("toolbarActions")}</span>
            <span
              className="sf-save-pill hidden sm:inline-flex"
              data-state={saveState === "saving" || saving ? "saving" : saveState}
              title={message || undefined}
            >
              <span className="sf-save-dot" aria-hidden />
              {saving || saveState === "saving"
                ? t("saveStatusSaving")
                : saveState === "dirty"
                  ? t("saveStatusDirty")
                  : t("saveStatusSaved")}
            </span>
            <Button asChild variant="outline" size="sm" className="rounded-full" title={t("previewDraftHint")} aria-label={t("preview")}>
              <Link href={`/editor/${site.id}/preview`} target="_blank">
                <Eye className="h-3.5 w-3.5" aria-hidden />
                <span className="hidden lg:inline">{t("preview")}</span>
              </Link>
            </Button>
            {publishedAt ? (
              <Button asChild variant="outline" size="sm" className="hidden rounded-full sm:inline-flex" title={t("view")} aria-label={t("view")}>
                <Link href={`/s/${site.slug}`} target="_blank">
                  <Eye className="h-3.5 w-3.5" aria-hidden />
                  <span className="hidden xl:inline">{t("view")}</span>
                </Link>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="hidden rounded-full opacity-50 sm:inline-flex"
                disabled
                title={t("viewPublicDisabled")}
                aria-label={t("viewPublicDisabled")}
              >
                <EyeOff className="h-3.5 w-3.5" aria-hidden />
                <span className="hidden xl:inline">{t("view")}</span>
              </Button>
            )}
            <Button variant="outline" size="sm" className="rounded-full" onClick={() => save(false)} disabled={saving || publishing} title={t("helpSave")} aria-label={saving ? t("saving") : t("save")}>
              <Save className="h-3.5 w-3.5" aria-hidden />
              <span className="hidden sm:inline">{saving ? t("saving") : t("save")}</span>
            </Button>
            <Button
              size="sm"
              className="rounded-full bg-teal-800 shadow-sm hover:bg-teal-700"
              onClick={() => save(true)}
              disabled={publishing || saving || saveState === "saving"}
              title={saving || saveState === "saving" ? t("publishDisabledSaving") : t("helpPublish")}
              aria-label={publishing ? t("publishing") : t("publish")}
            >
              <Upload className="h-3.5 w-3.5" aria-hidden />
              <span className="hidden sm:inline">{publishing ? t("publishing") : t("publish")}</span>
            </Button>

            <div className="relative" ref={moreRef}>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                title={t("moreActions")}
                aria-label={t("moreActions")}
                aria-expanded={moreOpen}
                onClick={() => setMoreOpen((o) => !o)}
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden />
              </Button>
              {moreOpen ? (
                <div className="absolute end-0 top-full z-50 mt-1 w-56 rounded-2xl border border-stone-200/80 bg-white p-1.5 shadow-xl dark:border-stone-700 dark:bg-stone-900">
                  <div className="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-stone-400 sm:hidden">{t("toolbarContent")}</div>
                  <div className="space-y-0.5 sm:hidden">
                    <div className="px-2 py-1">
                      <Select
                        value={pageId}
                        onValueChange={(id) => { setPageId(id); setMoreOpen(false); }}
                        aria-label={t("pageSelect")}
                        triggerClassName="h-8 w-full rounded-xl text-[11px] font-bold"
                        options={content.pages.map((p) => ({ value: p.id, label: p.title }))}
                      />
                    </div>
                    <div className="px-2 py-1">
                      <Select
                        value={editLocale}
                        onValueChange={(v) => { setEditLocale(v); setMoreOpen(false); }}
                        aria-label={t("contentLang")}
                        triggerClassName="h-8 w-full rounded-xl text-[11px] font-bold"
                        options={locales.map((code) => ({
                          value: code,
                          label: isLocaleCode(code) ? LOCALE_META[code].nativeLabel : code,
                        }))}
                      />
                    </div>
                    <button type="button" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-start text-xs font-semibold hover:bg-stone-50 disabled:opacity-40 dark:hover:bg-stone-800" onClick={() => { undo(); setMoreOpen(false); }} disabled={!canUndo}>
                      <Undo2 className="h-3.5 w-3.5" aria-hidden /> {t("undo")}
                    </button>
                    <button type="button" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-start text-xs font-semibold hover:bg-stone-50 disabled:opacity-40 dark:hover:bg-stone-800" onClick={() => { redo(); setMoreOpen(false); }} disabled={!canRedo}>
                      <Redo2 className="h-3.5 w-3.5" aria-hidden /> {t("redo")}
                    </button>
                  </div>
                  <div className="my-1 h-px bg-stone-200/80 dark:bg-stone-700 md:hidden" />
                  <div className="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-stone-400 md:hidden">{t("toolbarSite")}</div>
                  <button type="button" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-start text-xs font-semibold hover:bg-stone-50 md:hidden dark:hover:bg-stone-800" onClick={() => { openSiteSection(null); setMoreOpen(false); }}>
                    <Settings2 className="h-3.5 w-3.5" aria-hidden /> {t("openSiteSettings")}
                  </button>
                  <button type="button" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-start text-xs font-semibold hover:bg-stone-50 md:hidden dark:hover:bg-stone-800" onClick={() => { openSiteSection("seo"); setMoreOpen(false); }}>
                    <Search className="h-3.5 w-3.5" aria-hidden /> {t("openSeo")}
                  </button>
                  <button type="button" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-start text-xs font-semibold hover:bg-stone-50 md:hidden dark:hover:bg-stone-800" onClick={() => { openSiteSection("domain"); setMoreOpen(false); }}>
                    <Globe className="h-3.5 w-3.5" aria-hidden /> {t("openDomain")}
                  </button>
                  <button type="button" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-start text-xs font-semibold hover:bg-stone-50 md:hidden dark:hover:bg-stone-800" onClick={() => { openSiteSection("secrets"); setMoreOpen(false); }}>
                    <KeyRound className="h-3.5 w-3.5" aria-hidden /> {t("openSecrets")}
                  </button>
                  <button type="button" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-start text-xs font-semibold hover:bg-stone-50 md:hidden dark:hover:bg-stone-800" onClick={() => { setLeftCollapsed(false); writeCollapsedPref(LEFT_COLLAPSED_KEY, false); setLeftTab("cms"); setMobilePanel("left"); setMoreOpen(false); }}>
                    <Library className="h-3.5 w-3.5" aria-hidden /> {t("openCms")}
                  </button>
                  <div className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 md:hidden">
                    <span className="text-xs font-semibold">{t("chromeTheme")}</span>
                    <ThemeToggleButton />
                  </div>
                  <div className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 lg:hidden">
                    <span className="text-xs font-semibold">{t("appUiLang")}</span>
                    <PlatformLangSwitcher size="compact" />
                  </div>
                  <div className="my-1 h-px bg-stone-200/80 dark:bg-stone-700" />
                  {publishedAt ? (
                    <Link href={`/s/${site.slug}`} target="_blank" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold hover:bg-stone-50 sm:hidden dark:hover:bg-stone-800" onClick={() => setMoreOpen(false)}>
                      <Eye className="h-3.5 w-3.5" aria-hidden /> {t("view")}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-stone-400 sm:hidden" title={t("viewPublicDisabled")}>
                      <EyeOff className="h-3.5 w-3.5" aria-hidden /> {t("viewPublicDisabled")}
                    </div>
                  )}
                  <Link href={`/editor/${site.id}/preview`} target="_blank" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold hover:bg-stone-50 dark:hover:bg-stone-800" onClick={() => setMoreOpen(false)}>
                    <Eye className="h-3.5 w-3.5" aria-hidden /> {t("previewDraft")}
                  </Link>
                </div>
              ) : null}
            </div>
          </div>

          {/* Mobile panel toggles — keep separate from Publish */}
          <div className="flex shrink-0 items-center gap-1 xl:hidden">
            <button
              type="button"
              onClick={() => setMobilePanel((m) => (m === "left" ? "none" : "left"))}
              className="sf-panel inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--ring)]"
              title={t("helpInsert")}
              aria-label={t("mobileLeft")}
              aria-pressed={mobilePanel === "left"}
            >
              <PanelLeft className="h-3.5 w-3.5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setMobilePanel((m) => (m === "right" ? "none" : "right"))}
              className="sf-panel inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--ring)]"
              title={t("helpInspect")}
              aria-label={t("mobileRight")}
              aria-pressed={mobilePanel === "right"}
            >
              <PanelRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </div>
      </header>

      <div className="relative flex flex-1 min-h-0 px-2 pb-2 sm:px-3 sm:pb-3 gap-2 sm:gap-3">
{mobilePanel !== "none" ? (
          <button type="button" aria-label={t("close")} className="fixed inset-0 z-40 bg-stone-950/40 backdrop-blur-[2px] xl:hidden" onClick={() => setMobilePanel("none")} />
        ) : null}
        {/* Left panel + Figma-like seam (xl+) / drawer (mobile) */}
        <div
          className={`relative shrink-0 transition-[width] duration-300 ease-out
            max-xl:contents
            ${leftCollapsed ? "xl:w-10" : "xl:w-[300px]"}`}
        >
          {leftCollapsed ? (
            <button
              type="button"
              className="sf-panel-rail h-full w-full"
              title={t("expandLeft")}
              aria-label={t("expandLeft")}
              onClick={toggleLeftCollapsed}
            >
              <PanelLeft className="h-4 w-4 shrink-0" />
              <ChevronRight className="h-3.5 w-3.5 shrink-0 rtl:rotate-180" />
            </button>
          ) : null}
          <aside
            className={`sf-panel flex min-h-0 flex-col overflow-hidden rounded-[var(--radius-card)] backdrop-blur-xl
              max-w-[92vw] transition-[opacity] duration-300 ease-out
              max-xl:fixed max-xl:inset-y-0 max-xl:start-0 max-xl:z-50 max-xl:w-[min(100%,320px)] max-xl:rounded-none max-xl:border-e
              ${mobilePanel === "left" ? "max-xl:flex" : "max-xl:hidden"}
              ${leftCollapsed ? "xl:pointer-events-none xl:invisible xl:absolute xl:opacity-0" : "xl:relative xl:flex xl:h-full xl:w-full xl:opacity-100"}`}
            aria-hidden={leftCollapsed || undefined}
          >
          <div className="flex items-center justify-between border-b border-stone-200/70 px-3 py-2 xl:hidden dark:border-stone-800">
            <span className="text-xs font-bold">{t("leftPanel")}</span>
            <button type="button" onClick={() => setMobilePanel("none")} className="rounded-full p-1.5 hover:bg-stone-100 dark:hover:bg-stone-800"><X className="h-4 w-4" /></button>
          </div>
          <div className="flex border-b border-stone-200/70 p-1.5 gap-0.5 dark:border-stone-800" title={t("helpInsert")}>
            {(
              [
                ["insert", Plus, t("insert"), t("helpInsert")],
                ["layers", Layers, t("layers"), t("helpLayers")],
                ["pages", FilePlus2, t("pages"), t("helpPages")],
                ["cms", Library, t("cms"), t("helpCms")],
                ["langs", Languages, t("langs"), t("helpLangs")],
              ] as const
            ).map(([key, Icon, label, tip]) => (
              <button
                key={key}
                type="button"
                title={tip}
                onClick={() => setLeftTab(key)}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 rounded-2xl py-2 text-[10px] font-semibold transition ${
                  leftTab === key
                    ? "bg-stone-900 text-white shadow-sm dark:bg-stone-100 dark:text-stone-900"
                    : "text-stone-500 hover:bg-stone-100/80 dark:hover:bg-stone-800"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {leftTab === "insert" ? (
              <div className="space-y-4">
                <div>
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-stone-400">{t("addSection")}</div>
                  <InsertPalette mode="sections" onInsert={(t) => addBlock(t, selectedId)} />
                </div>
                <div>
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-stone-400">{t("addElement")}</div>
                  <InsertPalette mode="elements" onInsert={(t) => addBlock(t, selectedId)} />
                </div>
                <div>
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-stone-400">{t("savedSections")}</div>
                  {(content.components || []).length === 0 ? (
                    <p className="text-[11px] text-stone-400 leading-5">{t("savedSectionsEmpty")}</p>
                  ) : (
                    <div className="space-y-1">
                      {(content.components || []).map((c) => (
                        <div key={c.id} className="flex items-center gap-1 rounded-2xl border border-stone-200/70 px-2 py-1.5 dark:border-stone-800">
                          <button type="button" className="flex-1 text-start text-xs font-semibold" onClick={() => insertSavedComponent(c.id)}>
                            {c.name}
                          </button>
                          <button type="button" className="text-[10px] font-semibold px-1 text-red-600 dark:text-rose-400" onClick={() => removeSavedComponent(c.id)}>
                            {t("delete")}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {leftTab === "cms" ? <CollectionsPanel siteId={site.id} /> : null}

            {leftTab === "layers" ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between px-1 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-stone-400">{page.title}</span>
                  <button type="button" className="text-[10px] font-semibold text-teal-800" onClick={() => setLeftTab("insert")}>
                    + {t("add")}
                  </button>
                </div>
                {page.blocks.map((b, i) => {
                  const parts = listBlockParts(b, editLocale, content.defaultLocale || "ar");
                  const blockSelected = selectedId === b.id;
                  return (
                  <div
                    key={b.id}
                    draggable
                    onDragStart={() => setDragId(b.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => reorderByDrag(b.id)}
                    className={`rounded-2xl border px-2.5 py-2.5 text-sm cursor-grab active:cursor-grabbing transition ${
                      blockSelected && !selectedPart
                        ? "border-teal-600/40 bg-teal-50 shadow-sm dark:bg-teal-950/40"
                        : blockSelected
                          ? "border-teal-600/25 bg-teal-50/50 dark:bg-teal-950/20"
                          : "border-transparent hover:bg-stone-50 dark:hover:bg-stone-800/60"
                    }`}
                  >
                    <button type="button" className="w-full text-start font-medium text-[12px] text-stone-800 dark:text-stone-100" onClick={() => selectBlock(b.id)}>
                      {BLOCK_META[b.type].label}
                    </button>
                    {parts.length > 0 ? (
                      <div className="mt-1.5 ms-2 space-y-0.5 border-s border-stone-200/80 ps-2 dark:border-stone-700">
                        {parts.map((ch) => (
                          <button
                            key={ch.part}
                            type="button"
                            onClick={() => selectTarget(b.id, ch.part)}
                            className={`block w-full truncate rounded-lg px-2 py-1 text-start text-[11px] transition ${
                              blockSelected && selectedPart === ch.part
                                ? "bg-teal-700/90 text-white"
                                : "text-stone-500 hover:bg-stone-100 hover:text-stone-800 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100"
                            }`}
                          >
                            {ch.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    <div className="mt-1.5 flex gap-0.5">
                      <IconBtn onClick={() => moveBlock(b.id, -1)} disabled={i === 0}><ChevronUp className="h-3.5 w-3.5" /></IconBtn>
                      <IconBtn onClick={() => moveBlock(b.id, 1)} disabled={i === page.blocks.length - 1}><ChevronDown className="h-3.5 w-3.5" /></IconBtn>
                      <IconBtn onClick={() => duplicateBlock(b.id)}><Copy className="h-3.5 w-3.5" /></IconBtn>
                      <IconBtn onClick={() => saveAsComponent(b.id)} title={t("saveAsSection")}><BookmarkPlus className="h-3.5 w-3.5" /></IconBtn>
                      <IconBtn onClick={() => removeBlock(b.id)} danger><Trash2 className="h-3.5 w-3.5" /></IconBtn>
                    </div>
                  </div>
                  );
                })}
              </div>
            ) : null}

            {leftTab === "pages" ? (
              <div className="space-y-2">
                <Button size="sm" className="w-full rounded-full bg-teal-800 hover:bg-teal-700" onClick={addPage}>
                  <Plus className="h-3.5 w-3.5" /> {t("addPage")}
                </Button>
                {content.pages.map((p, i) => (
                  <div
                    key={p.id}
                    className={`rounded-2xl border p-3 ${
                      p.id === page.id
                        ? "border-teal-600/30 bg-white shadow-sm dark:bg-stone-950"
                        : "border-stone-200/70 bg-white/50 dark:border-stone-800 dark:bg-stone-900/40"
                    }`}
                  >
                    <button
                      type="button"
                      className="w-full text-start"
                      onClick={() => {
                        setPageId(p.id);
                        selectBlock(p.blocks[0]?.id ?? null);
                      }}
                    >
                      <div className="text-sm font-semibold">{p.title}</div>
                      <div className="text-[10px] text-stone-400 font-mono" dir="ltr">
                        /{p.slug} · {p.blocks.length}
                      </div>
                    </button>
                    {p.id === page.id ? (
                      <div className="mt-2 space-y-2">
                        <Input
                          value={pageTitleDraft}
                          onChange={(e) => setPageTitleDraft(e.target.value)}
                          onBlur={() => renamePage(p.id, pageTitleDraft)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") renamePage(p.id, pageTitleDraft);
                          }}
                          className="h-9 rounded-2xl text-xs"
                        />
                        
                        <div className="space-y-1.5 rounded-2xl border border-stone-200/80 p-2.5 dark:border-stone-800">
                          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-stone-400">{t("pageSeo")}</div>
                          <Input
                            value={p.seoTitle || ""}
                            onChange={(e) => updatePageSeo(p.id, { seoTitle: e.target.value })}
                            placeholder={t("seoTitlePh")}
                            className="h-8 rounded-xl text-xs"
                          />
                          <Textarea
                            value={p.seoDescription || ""}
                            onChange={(e) => updatePageSeo(p.id, { seoDescription: e.target.value })}
                            placeholder={t("seoDescPh")}
                            className="min-h-[56px] rounded-xl text-xs"
                          />
                          <MediaField
                            label={t("ogImageLabel")}
                            value={p.seoOgImage || ""}
                            onChange={(url) => updatePageSeo(p.id, { seoOgImage: url })}
                            kind="image"
                            accept="image/*"
                          />
                          <p className="text-[9px] leading-4 text-stone-400">{t("seoFallbackHint")}</p>
                        </div>
<div className="flex gap-0.5">
                          <IconBtn onClick={() => movePage(p.id, -1)} disabled={i === 0}><ChevronUp className="h-3.5 w-3.5" /></IconBtn>
                          <IconBtn onClick={() => movePage(p.id, 1)} disabled={i === content.pages.length - 1}><ChevronDown className="h-3.5 w-3.5" /></IconBtn>
                          <IconBtn onClick={() => deletePage(p.id)} disabled={content.pages.length <= 1} danger><Trash2 className="h-3.5 w-3.5" /></IconBtn>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

            {leftTab === "langs" ? (
              <div className="space-y-3">
                <p className="text-xs text-stone-500 leading-6">{t("langsHelp")}</p>
                <div className="space-y-2">
                  {LOCALE_CODES.map((code) => {
                    const active = locales.includes(code);
                    const isDefault = content.defaultLocale === code;
                    return (
                      <div
                        key={code}
                        className={`flex items-center justify-between rounded-2xl border px-3 py-2.5 ${
                          active ? "border-teal-600/30 bg-teal-50/70 dark:bg-teal-950/30" : "border-stone-200 dark:border-stone-800"
                        }`}
                      >
                        <div>
                          <div className="text-sm font-semibold">{LOCALE_META[code].nativeLabel}</div>
                          <div className="text-[10px] text-stone-400">
                            {LOCALE_META[code].label} · {LOCALE_META[code].dir.toUpperCase()}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {active ? (
                            <button
                              type="button"
                              onClick={() => setDefaultLocale(code)}
                              className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                                isDefault
                                  ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900"
                                  : "bg-white text-stone-500 border border-stone-200 dark:bg-stone-900 dark:text-stone-300 dark:border-stone-600"
                              }`}
                            >
                              {t("default")}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => toggleLocale(code)}
                            className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                              active
                                ? "bg-teal-800 text-white dark:bg-teal-500 dark:text-teal-950"
                                : "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300"
                            }`}
                          >
                            {active ? t("enabled") : t("enable")}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
          </aside>
          {!leftCollapsed ? (
            <button
              type="button"
              className="sf-seam-toggle"
              data-side="start"
              title={t("collapseLeft")}
              aria-label={t("collapseLeft")}
              onClick={toggleLeftCollapsed}
            >
              <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" />
            </button>
          ) : null}
        </div>

        {/* Canvas */}
        <main className="relative flex-1 overflow-auto rounded-[1.75rem] border border-stone-300/25 bg-[#dfd9cf]/45 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] md:p-8 dark:border-stone-800 dark:bg-stone-950/40 dark:shadow-none" onClick={() => { setSelectedId(null); setSelectedPart(null); }}>
          <div
            className="sf-device-shell"
            style={{
              width: typeof canvasWidth === "number" ? canvasWidth + (viewport === "mobile" ? 28 : viewport === "tablet" ? 36 : 0) : canvasWidth,
              maxWidth: "100%",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between px-1 text-[10px] text-stone-500">
              <span>
                {page.title}
                <span className="font-mono ms-2" dir="ltr">/{page.slug}</span>
                <span className="ms-2 rounded-full bg-white/70 px-2 py-0.5 text-stone-700 dark:bg-stone-900 dark:text-stone-200">
                  {isLocaleCode(editLocale) ? LOCALE_META[editLocale].nativeLabel : editLocale}
                </span>
              </span>
              <span className="font-mono" dir="ltr" title={t("deviceFrame")}>
                {typeof canvasWidth === "number" ? `${canvasWidth}px · ${viewport}` : "fluid · laptop"}
              </span>
            </div>
            {viewport === "laptop" ? (
              <div
                className="overflow-hidden rounded-[1.75rem] border border-stone-300/40 bg-white shadow-[0_30px_80px_-36px_rgba(28,25,23,0.5)] dark:border-stone-700"
                lang={editLocale}
                dir={localeDir(editLocale)}
                data-sf-preview="content"
              >
                <SiteRenderer
                  content={content}
                  pageId={page.id}
                  selectedBlockId={selectedId}
                  selectedPart={selectedPart}
                  hoveredBlockId={hoveredId}
                  onSelectBlock={selectBlock}
                  onSelectPart={selectTarget}
                  onHoverBlock={setHoveredId}
                  locale={editLocale}
                  colorMode={previewMode}
                />
              </div>
            ) : (
              <div className="sf-device-chrome" data-device={viewport} aria-label={t("deviceFrame")}>
                {viewport === "mobile" ? <div className="sf-device-notch" aria-hidden /> : null}
                <div
                  className="sf-device-screen"
                  lang={editLocale}
                  dir={localeDir(editLocale)}
                  data-sf-preview="content"
                  style={{ width: typeof canvasWidth === "number" ? canvasWidth : "100%", maxWidth: "100%", marginInline: "auto" }}
                >
                  <SiteRenderer
                    content={content}
                    pageId={page.id}
                    selectedBlockId={selectedId}
                    selectedPart={selectedPart}
                    hoveredBlockId={hoveredId}
                    onSelectBlock={selectBlock}
                    onSelectPart={selectTarget}
                    onHoverBlock={setHoveredId}
                    locale={editLocale}
                    colorMode={previewMode}
                  />
                </div>
                {viewport === "mobile" ? <div className="sf-device-home" aria-hidden /> : null}
              </div>
            )}
          </div>
        </main>

        {/* Right inspector + Figma-like seam */}
        <div
          className={`relative shrink-0 transition-[width] duration-300 ease-out
            max-xl:contents
            ${rightCollapsed ? "xl:w-10" : "xl:w-[320px]"}`}
        >
          {rightCollapsed ? (
            <button
              type="button"
              className="sf-panel-rail h-full w-full"
              title={t("expandRight")}
              aria-label={t("expandRight")}
              onClick={toggleRightCollapsed}
            >
              <ChevronLeft className="h-3.5 w-3.5 shrink-0 rtl:rotate-180" />
              <PanelRight className="h-4 w-4 shrink-0" />
            </button>
          ) : null}
          <aside
            className={`sf-panel flex min-h-0 flex-col overflow-hidden rounded-[var(--radius-card)] backdrop-blur-xl
              max-w-[92vw] transition-[opacity] duration-300 ease-out
              max-xl:fixed max-xl:inset-y-0 max-xl:end-0 max-xl:z-50 max-xl:w-[min(100%,340px)] max-xl:rounded-none max-xl:border-s
              ${mobilePanel === "right" ? "max-xl:flex" : "max-xl:hidden"}
              ${rightCollapsed ? "xl:pointer-events-none xl:invisible xl:absolute xl:opacity-0" : "xl:relative xl:flex xl:h-full xl:w-full xl:opacity-100"}`}
            aria-hidden={rightCollapsed || undefined}
          >
          <div className="flex items-center justify-between border-b border-stone-200/70 px-3 py-2 xl:hidden dark:border-stone-800">
            <span className="text-xs font-bold">{t("inspector")}</span>
            <button type="button" onClick={() => setMobilePanel("none")} className="rounded-full p-1.5 hover:bg-stone-100 dark:hover:bg-stone-800"><X className="h-4 w-4" /></button>
          </div>
          <div className="border-b border-stone-200/70 p-3 dark:border-stone-800">
            <div className="mb-2 hidden xl:block">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-stone-400">{t("inspector")}</span>
            </div>
            <div className="flex gap-1 rounded-2xl bg-stone-100/80 p-1 dark:bg-stone-950">
              <button type="button" title={t("helpInspect")} onClick={() => setRightTab("inspect")} className={`flex-1 rounded-xl py-1.5 text-[10px] font-semibold ${rightTab === "inspect" ? "bg-white text-stone-900 shadow-sm dark:bg-stone-800 dark:text-stone-50" : "text-stone-500 dark:text-stone-400"}`}>{t("inspect")}</button>
              <button type="button" title={t("helpSite")} onClick={() => { setRightTab("site"); setSiteFocus(null); }} className={`flex-1 rounded-xl py-1.5 text-[10px] font-semibold ${rightTab === "site" ? "bg-white text-stone-900 shadow-sm dark:bg-stone-800 dark:text-stone-50" : "text-stone-500 dark:text-stone-400"}`}>{t("site")}</button>
              <button type="button" title={t("helpReplies")} onClick={() => setRightTab("replies")} className={`flex-1 rounded-xl py-1.5 text-[10px] font-semibold ${rightTab === "replies" ? "bg-white text-stone-900 shadow-sm dark:bg-stone-800 dark:text-stone-50" : "text-stone-500 dark:text-stone-400"}`}>{t("replies")}</button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {rightTab === "inspect" ? (
              <InspectorPanel
                content={content}
                selected={selected}
                selectedPart={selectedPart}
                onSelectPart={(part) => selectedId && selectTarget(selectedId, part)}
                editLocale={editLocale}
                pages={content.pages.map((p) => ({ slug: p.slug, title: p.title }))}
                siteId={site.id}
                onUpdateTokens={updateTokens}
                onUpdateProp={updateBlockProps}
                onUpdateLocalizedProp={updateLocalizedProp}
                onUpdatePropsObject={updateBlockPropsObject}
              />
            ) : rightTab === "replies" ? (
              <SubmissionsPanel siteId={site.id} />
            ) : (
              <SiteSettingsPanel siteId={site.id} settings={settings} focusSection={siteFocus} focusNonce={siteFocusNonce} onChange={(patch) => setSettings((s) => ({ ...s, ...patch }))} />
            )}
          </div>
          </aside>
          {!rightCollapsed ? (
            <button
              type="button"
              className="sf-seam-toggle"
              data-side="end"
              title={t("collapseRight")}
              aria-label={t("collapseRight")}
              onClick={toggleRightCollapsed}
            >
              <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  disabled,
  title,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`h-7 w-7 inline-flex items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--ring)] disabled:opacity-30 ${
        danger
          ? "text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/50"
          : "text-stone-500 hover:bg-stone-100 hover:text-stone-800 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100"
      }`}
    >
      {children}
    </button>
  );
}
