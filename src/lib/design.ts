import { z } from "zod";

export const LOCALE_CODES = ["ar", "en", "fr", "es"] as const;
export type LocaleCode = (typeof LOCALE_CODES)[number];

export const LOCALE_META: Record<
  LocaleCode,
  { label: string; nativeLabel: string; dir: "rtl" | "ltr" }
> = {
  ar: { label: "Arabic", nativeLabel: "العربية", dir: "rtl" },
  en: { label: "English", nativeLabel: "English", dir: "ltr" },
  fr: { label: "French", nativeLabel: "Français", dir: "ltr" },
  es: { label: "Spanish", nativeLabel: "Español", dir: "ltr" },
};

export const colorPaletteSchema = z.object({
  primary: z.string(),
  secondary: z.string(),
  background: z.string(),
  surface: z.string(),
  text: z.string(),
  muted: z.string(),
  accent: z.string(),
});

export const designTokensSchema = z.object({
  colors: colorPaletteSchema,
  colorsDark: colorPaletteSchema.optional(),
  fonts: z.object({
    heading: z.string(),
    body: z.string(),
  }),
  spacing: z.object({
    sectionY: z.number().min(16).max(160),
    blockGap: z.number().min(8).max(80),
    contentMaxWidth: z.number().min(640).max(1400),
  }),
  radius: z.number().min(0).max(48),
  rtl: z.boolean().default(true),
  themeMode: z.enum(["light", "dark", "system"]).default("system"),
});

export const blockTypes = [
  "navbar",
  "hero",
  "features",
  "gallery",
  "pricing",
  "testimonials",
  "faq",
  "cta",
  "contact",
  "footer",
  "stats",
  "heading",
  "text",
  "image",
  "video",
  "button",
  "spacer",
  "columns",
  "divider",
  "list",
  "form",
  "collectionList",
] as const;

export const blockSchema = z.object({
  id: z.string(),
  type: z.enum(blockTypes),
  props: z.record(z.string(), z.unknown()),
});

export const pageSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  blocks: z.array(blockSchema),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  seoOgImage: z.string().optional(),
});

export const savedComponentSchema = z.object({
  id: z.string(),
  name: z.string(),
  blocks: z.array(blockSchema).min(1),
});

export const siteContentSchema = z.object({
  tokens: designTokensSchema,
  locales: z.array(z.string().min(2).max(12)).min(1).default(["ar"]),
  defaultLocale: z.string().min(2).max(12).default("ar"),
  pages: z.array(pageSchema).min(1),
  components: z.array(savedComponentSchema).optional(),
});

export type ColorPalette = z.infer<typeof colorPaletteSchema>;
export type DesignTokens = z.infer<typeof designTokensSchema>;
export type Block = z.infer<typeof blockSchema>;
export type Page = z.infer<typeof pageSchema>;
export type SiteContent = z.infer<typeof siteContentSchema>;
export type SavedComponent = z.infer<typeof savedComponentSchema>;
export type BlockType = (typeof blockTypes)[number];
export type BlockCategory = "sections" | "elements";
/** Locale → copy map (keys are site content locales, not platform UI lang). */
export type LocalizedMap = Record<string, string>;
/** Plain string (legacy / single-locale) or per-locale map. */
export type LocalizedString = string | LocalizedMap;

export function isLocalizedMap(v: unknown): v is LocalizedMap {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export const BLOCK_META: Record<
  BlockType,
  { label: string; category: BlockCategory; description: string }
> = {
  navbar: { label: "شريط التنقل", category: "sections", description: "شعار وروابط علوية" },
  hero: { label: "قسم المقدمة", category: "sections", description: "عنوان رئيسي مع زر دعوة" },
  features: { label: "مميزات", category: "sections", description: "شبكة بطاقات مميزات" },
  gallery: { label: "معرض", category: "sections", description: "شبكة صور/أعمال" },
  pricing: { label: "أسعار", category: "sections", description: "خطط تسعير" },
  testimonials: { label: "شهادات", category: "sections", description: "آراء العملاء" },
  faq: { label: "أسئلة شائعة", category: "sections", description: "سؤال وجواب" },
  cta: { label: "دعوة للتواصل", category: "sections", description: "شريط تحفيزي مع زر" },
  contact: { label: "تواصل", category: "sections", description: "بيانات ونموذج" },
  footer: { label: "تذييل", category: "sections", description: "حقوق وروابط سفلية" },
  stats: { label: "إحصائيات", category: "sections", description: "أرقام بارزة" },
  heading: { label: "عنوان", category: "elements", description: "عنوان قابل للتخصيص" },
  text: { label: "نص", category: "elements", description: "فقرة نصية" },
  image: { label: "صورة", category: "elements", description: "صورة مع تعليق" },
  video: { label: "فيديو", category: "elements", description: "فيديو مرفوع أو رابط" },
  button: { label: "زر", category: "elements", description: "زر إجراء" },
  spacer: { label: "مسافة", category: "elements", description: "فراغ عمودي" },
  columns: { label: "عمودان", category: "elements", description: "تخطيط عمودين" },
  divider: { label: "فاصل", category: "elements", description: "خط فاصل" },
  list: { label: "قائمة", category: "elements", description: "قائمة نقاط" },
  form: { label: "نموذج", category: "sections", description: "نموذج تواصل مع ردود" },
  collectionList: { label: "قائمة مجموعة", category: "sections", description: "عرض عناصر من مجموعات المحتوى" },
};

export const BLOCK_LABELS: Record<BlockType, string> = Object.fromEntries(
  Object.entries(BLOCK_META).map(([k, v]) => [k, v.label])
) as Record<BlockType, string>;

export const defaultLightColors: ColorPalette = {
  primary: "#0d9488",
  secondary: "#1c1917",
  background: "#ffffff",
  surface: "#f5f3ef",
  text: "#1c1917",
  muted: "#78716c",
  accent: "#d4a574",
};

export const defaultDarkColors: ColorPalette = {
  primary: "#2dd4bf",
  secondary: "#fafaf9",
  background: "#0c0a09",
  surface: "#1c1917",
  text: "#fafaf9",
  muted: "#a8a29e",
  accent: "#e7c399",
};

export const defaultTokens: DesignTokens = {
  colors: { ...defaultLightColors },
  colorsDark: { ...defaultDarkColors },
  fonts: { heading: "Cairo", body: "Cairo" },
  spacing: { sectionY: 88, blockGap: 28, contentMaxWidth: 1120 },
  radius: 24,
  rtl: true,
  themeMode: "system",
};

/** Props that hold human-readable copy (localizable) */
export const LOCALIZABLE_PROP_KEYS = new Set([
  "brand",
  "links",
  "ctaLabel",
  "eyebrow",
  "headline",
  "subheadline",
  "secondaryLabel",
  "title",
  "subtitle",
  "items",
  "body",
  "buttonLabel",
  "email",
  "phone",
  "address",
  "text",
  "alt",
  "caption",
  "label",
  "leftTitle",
  "leftBody",
  "rightTitle",
  "rightBody",
  "columns",
  "submitLabel",
  "successMessage",
  "fieldsConfig",
]);

export function isLocaleCode(v: string): v is LocaleCode {
  return (LOCALE_CODES as readonly string[]).includes(v);
}

export function localeDir(locale: string): "rtl" | "ltr" {
  if (isLocaleCode(locale)) return LOCALE_META[locale].dir;
  return locale === "ar" || locale.startsWith("ar") ? "rtl" : "ltr";
}

export function resolveLocalized(
  value: unknown,
  locale: string,
  fallbackLocale = "ar"
): string {
  if (typeof value === "string") return value;
  if (isLocalizedMap(value)) {
    if (typeof value[locale] === "string") return value[locale];
    if (typeof value[fallbackLocale] === "string") return value[fallbackLocale];
    const first = Object.values(value).find((v) => typeof v === "string");
    return first ?? "";
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

export function setLocalized(
  value: unknown,
  locale: string,
  text: string,
  allLocales: string[] = ["ar"]
): LocalizedMap {
  let base: LocalizedMap = {};
  if (typeof value === "string") {
    for (const loc of allLocales) base[loc] = value;
  } else if (isLocalizedMap(value)) {
    base = { ...value };
  }
  base[locale] = text;
  return base;
}

export function localizeProps(
  props: Record<string, unknown>,
  locale: string,
  fallbackLocale: string
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(props)) {
    if (LOCALIZABLE_PROP_KEYS.has(k)) {
      out[k] = resolveLocalized(v, locale, fallbackLocale);
    } else if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      out[k] = String(v);
    } else {
      out[k] = resolveLocalized(v, locale, fallbackLocale);
    }
  }
  return out;
}

export function resolvePalette(
  tokens: DesignTokens,
  mode: "light" | "dark"
): ColorPalette {
  if (mode === "dark") {
    return tokens.colorsDark ?? {
      primary: tokens.colors.primary,
      secondary: "#fafaf9",
      background: "#0c0a09",
      surface: "#1c1917",
      text: "#fafaf9",
      muted: "#a8a29e",
      accent: tokens.colors.accent,
    };
  }
  return tokens.colors;
}

export function tokensForRender(
  tokens: DesignTokens,
  mode: "light" | "dark",
  locale: string
): DesignTokens {
  const colors = resolvePalette(tokens, mode);
  return {
    ...tokens,
    colors,
    rtl: localeDir(locale) === "rtl",
  };
}

export function ensureContentDefaults(raw: SiteContent): SiteContent {
  const locales =
    raw.locales && raw.locales.length > 0
      ? raw.locales
      : [raw.defaultLocale || "ar"];
  return {
    ...raw,
    locales,
    defaultLocale: raw.defaultLocale || locales[0] || "ar",
    components: Array.isArray(raw.components) ? raw.components : [],
    tokens: {
      ...defaultTokens,
      ...raw.tokens,
      colors: { ...defaultTokens.colors, ...raw.tokens.colors },
      colorsDark: {
        ...defaultTokens.colorsDark!,
        ...(raw.tokens.colorsDark || {}),
      },
      fonts: { ...defaultTokens.fonts, ...raw.tokens.fonts },
      spacing: { ...defaultTokens.spacing, ...raw.tokens.spacing },
      themeMode: raw.tokens.themeMode || "system",
      radius: raw.tokens.radius ?? defaultTokens.radius,
      rtl: raw.tokens.rtl ?? true,
    },
    pages: (raw.pages || []).map((page) => ({
      ...page,
      blocks: page.blocks.map((block) => {
        if (block.type !== "navbar") return block;
        const props = { ...(block.props as Record<string, unknown>) };
        if (!Array.isArray(props.navItems)) {
          props.navItems = ensureNavItems(props, locales);
          props.links = syncLinksCsvFromNavItems(props.navItems as NavItem[], locales);
        }
        return { ...block, props };
      }),
    })),
  };
}

export function createBlankContent(title = "صفحتي"): SiteContent {
  return {
    tokens: {
      ...defaultTokens,
      colors: { ...defaultTokens.colors },
      colorsDark: { ...defaultTokens.colorsDark! },
      fonts: { ...defaultTokens.fonts },
      spacing: { ...defaultTokens.spacing },
    },
    locales: ["ar", "en"],
    defaultLocale: "ar",
    components: [],
    pages: [
      {
        id: "page-home",
        title: "الرئيسية",
        slug: "home",
        blocks: [
          { id: "b-nav", type: "navbar", props: defaultPropsFor("navbar") },
          {
            id: "b-hero",
            type: "hero",
            props: {
              ...defaultPropsFor("hero"),
              headline: { ar: title, en: title },
              subheadline: {
                ar: "ابدأ بإضافة أقسام وعناصر من لوحة الإدراج — وبدّل اللغة من الشريط العلوي",
                en: "Add sections and elements from the insert panel — switch language from the toolbar",
              },
            },
          },
          {
            id: "b-text",
            type: "text",
            props: {
              title: { ar: "عن الموقع", en: "About" },
              body: {
                ar: "هذا نص تجريبي. يمكنك تعديله بالكامل لكل لغة، أو إضافة صفحات وأقسام جديدة.",
                en: "This is sample copy. Edit it per language, or add new pages and sections.",
              },
            },
          },
          { id: "b-footer", type: "footer", props: defaultPropsFor("footer") },
        ],
      },
    ],
  };
}

export function defaultPropsFor(type: BlockType): Record<string, unknown> {
  switch (type) {
    case "navbar":
      return {
        brand: { ar: "SiteForge", en: "SiteForge", fr: "SiteForge", es: "SiteForge" },
        links: {
          ar: "الرئيسية,الخدمات,تواصل",
          en: "Home,Services,Contact",
          fr: "Accueil,Services,Contact",
          es: "Inicio,Servicios,Contacto",
        },
        navItems: [
          {
            id: "nav-home",
            label: { ar: "الرئيسية", en: "Home", fr: "Accueil", es: "Inicio" },
            href: "#",
            linkMode: "url",
            linkPageSlug: "",
          },
          {
            id: "nav-services",
            label: { ar: "الخدمات", en: "Services", fr: "Services", es: "Servicios" },
            href: "#",
            linkMode: "url",
            linkPageSlug: "",
          },
          {
            id: "nav-contact",
            label: { ar: "تواصل", en: "Contact", fr: "Contact", es: "Contacto" },
            href: "#",
            linkMode: "url",
            linkPageSlug: "",
          },
        ],
        ctaLabel: { ar: "ابدأ", en: "Start", fr: "Commencer", es: "Empezar" },
        ctaHref: "#",
        sticky: "false",
      };
    case "hero":
      return {
        eyebrow: { ar: "منصة البناء", en: "Site builder", fr: "Créateur de sites", es: "Creador de sitios" },
        headline: {
          ar: "عنوان رئيسي جذاب",
          en: "A compelling headline",
          fr: "Un titre convaincant",
          es: "Un titular convincente",
        },
        subheadline: {
          ar: "وصف قصير يوضح قيمة عرضك ويدفع الزائر للخطوة التالية",
          en: "A short line that explains your value and invites the next step",
          fr: "Une courte ligne qui explique votre valeur",
          es: "Una línea corta que explica tu valor",
        },
        ctaLabel: { ar: "اعرف المزيد", en: "Learn more", fr: "En savoir plus", es: "Saber más" },
        ctaHref: "#",
        secondaryLabel: { ar: "شاهد العرض", en: "Watch demo", fr: "Voir la démo", es: "Ver demo" },
        secondaryHref: "#",
        align: "center",
        showBadge: "true",
      };
    case "features":
      return {
        title: { ar: "المميزات", en: "Features", fr: "Fonctionnalités", es: "Funciones" },
        subtitle: {
          ar: "كل ما تحتاجه لإطلاق موقع احترافي",
          en: "Everything you need to launch a polished site",
          fr: "Tout pour lancer un site soigné",
          es: "Todo para lanzar un sitio pulido",
        },
        items: {
          ar: "سرعة|أطلق موقعك بسرعة دون تعقيد,مرونة|تحكم كامل بالتصميم والصفحات,احترافية|مظهر عصري متجاوب",
          en: "Speed|Launch fast without friction,Flexibility|Full design control,Polish|Modern responsive look",
          fr: "Vitesse|Lancez rapidement,Flexibilité|Contrôle total,Finition|Look moderne",
          es: "Velocidad|Lanza rápido,Flexibilidad|Control total,Acabado|Aspecto moderno",
        },
        columns: "3",
      };
    case "gallery":
      return {
        title: { ar: "معرض الأعمال", en: "Gallery", fr: "Galerie", es: "Galería" },
        subtitle: { ar: "مشاريع مختارة", en: "Selected work", fr: "Travaux sélectionnés", es: "Trabajos seleccionados" },
        items: {
          ar: "مشروع أ|وصف مختصر,مشروع ب|وصف مختصر,مشروع ج|وصف مختصر,مشروع د|وصف مختصر",
          en: "Project A|Short blurb,Project B|Short blurb,Project C|Short blurb,Project D|Short blurb",
        },
        columns: "3",
      };
    case "pricing":
      return {
        title: { ar: "الأسعار", en: "Pricing", fr: "Tarifs", es: "Precios" },
        subtitle: { ar: "اختر الخطة المناسبة", en: "Pick the right plan", fr: "Choisissez le bon plan", es: "Elige el plan" },
        items: {
          ar: "أساسي|مجاني|صفحة واحدة|محرر أساسي|دعم مجتمعي,احترافي|29$/شهر|صفحات غير محدودة|قوالب متقدمة|دعم أولوية|الأكثر شعبية,مؤسسات|حسب الطلب|فريق متعدد|تخصيص كامل|SLA",
          en: "Starter|Free|1 page|Basic editor|Community,Pro|$29/mo|Unlimited pages|Advanced templates|Priority support|Popular,Business|Custom|Multi-seat|Full customization|SLA",
        },
      };
    case "testimonials":
      return {
        title: { ar: "ماذا يقول عملاؤنا", en: "What clients say", fr: "Avis clients", es: "Opiniones" },
        items: {
          ar: "سارة م.|مديرة تسويق|غيّر SiteForge طريقة إطلاق حملاتنا.,كريم ع.|مصمم|تحكم بصري حقيقي بدون قيود.,نورا ح.|مؤسسة|العربية وRTL من الدرجة الأولى.",
          en: "Sara M.|Marketing|SiteForge changed how we launch.,Karim A.|Designer|Real visual control.,Nora H.|Founder|First-class Arabic & RTL.",
        },
      };
    case "faq":
      return {
        title: { ar: "أسئلة شائعة", en: "FAQ", fr: "FAQ", es: "FAQ" },
        items: {
          ar: "هل يمكنني إضافة صفحات؟|نعم من المحرر.,هل المسودة منفصلة؟|نعم — انشر لقطة مستقلة.,هل يدعم لغات متعددة؟|نعم: العربية والإنجليزية والفرنسية والإسبانية.",
          en: "Can I add pages?|Yes, from the editor.,Is draft separate?|Yes — publish an independent snapshot.,Multi-language?|Yes: AR, EN, FR, ES.",
        },
      };
    case "cta":
      return {
        title: { ar: "جاهز للانطلاق؟", en: "Ready to launch?", fr: "Prêt à démarrer ?", es: "¿Listo?" },
        body: {
          ar: "ابدأ مشروعك معنا اليوم وانشر خلال دقائق",
          en: "Start today and publish in minutes",
          fr: "Commencez aujourd'hui et publiez en minutes",
          es: "Empieza hoy y publica en minutos",
        },
        buttonLabel: { ar: "تواصل معنا", en: "Contact us", fr: "Nous contacter", es: "Contáctanos" },
        buttonHref: "#contact",
      };
    case "contact":
      return {
        title: { ar: "تواصل معنا", en: "Contact", fr: "Contact", es: "Contacto" },
        subtitle: { ar: "نرد خلال يوم عمل", en: "We reply within one business day", fr: "Réponse sous un jour", es: "Respondemos en un día" },
        email: "hello@example.com",
        phone: "+963 000 000 000",
        address: { ar: "دمشق، سوريا", en: "Damascus, Syria", fr: "Damas, Syrie", es: "Damasco, Siria" },
        buttonLabel: { ar: "إرسال", en: "Send", fr: "Envoyer", es: "Enviar" },
      };
    case "footer":
      return {
        brand: { ar: "SiteForge", en: "SiteForge" },
        text: {
          ar: "© 2026 جميع الحقوق محفوظة",
          en: "© 2026 All rights reserved",
          fr: "© 2026 Tous droits réservés",
          es: "© 2026 Todos los derechos reservados",
        },
        links: {
          ar: "خصوصية,شروط,تواصل",
          en: "Privacy,Terms,Contact",
          fr: "Confidentialité,Conditions,Contact",
          es: "Privacidad,Términos,Contacto",
        },
        columns: {
          ar: "المنتج|الميزات,القوالب,الأسعار|الشركة|من نحن,وظائف,مدونة|الدعم|مركز المساعدة,حالة الخدمة",
          en: "Product|Features,Templates,Pricing|Company|About,Careers,Blog|Support|Help center,Status",
        },
      };
    case "stats":
      return {
        title: { ar: "أرقام تتحدث", en: "Numbers that matter", fr: "Des chiffres clés", es: "Cifras clave" },
        items: {
          ar: "120+|مشروع منجز,98%|رضا العملاء,24/7|دعم فني",
          en: "120+|Projects,98%|Satisfaction,24/7|Support",
        },
      };
    case "heading":
      return {
        text: { ar: "عنوان القسم", en: "Section heading", fr: "Titre de section", es: "Título" },
        level: "h2",
        align: "start",
      };
    case "text":
      return {
        title: { ar: "", en: "" },
        body: {
          ar: "اكتب محتواك هنا. يمكنك تخصيص كل لغة على حدة.",
          en: "Write your content here. Customize each language separately.",
          fr: "Écrivez votre contenu ici.",
          es: "Escribe tu contenido aquí.",
        },
        align: "start",
      };
    case "image":
      return {
        src: "",
        alt: { ar: "صورة توضيحية", en: "Illustration", fr: "Illustration", es: "Ilustración" },
        caption: { ar: "تعليق الصورة", en: "Image caption", fr: "Légende", es: "Leyenda" },
        aspect: "16/9",
        rounded: "true",
      };
    case "video":
      return {
        src: "",
        poster: "",
        caption: { ar: "فيديو تعريفي", en: "Intro video", fr: "Vidéo", es: "Video" },
        autoplay: "false",
        loop: "false",
        muted: "true",
        controls: "true",
        aspect: "16/9",
        rounded: "true",
      };
    case "button":
      return {
        label: { ar: "اضغط هنا", en: "Click here", fr: "Cliquez ici", es: "Haz clic" },
        href: "#",
        variant: "primary",
        align: "start",
        size: "md",
      };
    case "spacer":
      return { height: "56" };
    case "columns":
      return {
        leftTitle: { ar: "العمود الأيمن", en: "First column" },
        leftBody: { ar: "محتوى العمود الأول — مثالي للنصوص أو الشرح.", en: "First column content." },
        rightTitle: { ar: "العمود الأيسر", en: "Second column" },
        rightBody: { ar: "محتوى العمود الثاني.", en: "Second column content." },
        ratio: "50/50",
      };
    case "divider":
      return { style: "solid", label: { ar: "", en: "" } };
    case "list":
      return {
        title: { ar: "النقاط الرئيسية", en: "Key points", fr: "Points clés", es: "Puntos clave" },
        items: {
          ar: "نقطة أولى مهمة,نقطة ثانية توضح القيمة,نقطة ثالثة تحفّز الإجراء",
          en: "First important point,Second value point,Third call-to-action point",
        },
        style: "check",
      };
    case "form":
      return {
        title: { ar: "راسلنا", en: "Contact us", fr: "Contactez-nous", es: "Contáctanos" },
        subtitle: {
          ar: "نرد خلال يوم عمل",
          en: "We reply within one business day",
          fr: "Réponse sous un jour",
          es: "Respondemos en un día",
        },
        fieldsConfig: "name,email,message",
        submitLabel: { ar: "إرسال", en: "Send", fr: "Envoyer", es: "Enviar" },
        successMessage: {
          ar: "شكراً لك! تم استلام رسالتك.",
          en: "Thanks! Your message was received.",
          fr: "Merci ! Message reçu.",
          es: "¡Gracias! Mensaje recibido.",
        },
      };
    case "collectionList":
      return {
        title: { ar: "المشاريع", en: "Projects", fr: "Projets", es: "Proyectos" },
        subtitle: {
          ar: "أحدث الأعمال من المجموعة",
          en: "Latest items from the collection",
          fr: "Derniers éléments",
          es: "Últimos elementos",
        },
        collectionSlug: "projects",
        columns: "3",
        limit: "6",
        cardTitleField: "title",
        cardBodyField: "summary",
        cardImageField: "image",
        cardUrlField: "url",
      };
    default:
      return {};
  }
}

export const FONT_OPTIONS = [
  "Cairo",
  "Tajawal",
  "Inter",
  "Roboto",
  "Poppins",
  "Georgia",
  "system-ui",
];

export const SECTION_TYPES = blockTypes.filter((t) => BLOCK_META[t].category === "sections");
export const ELEMENT_TYPES = blockTypes.filter((t) => BLOCK_META[t].category === "elements");

export function parseCsv(raw: unknown): string[] {
  if (typeof raw !== "string") return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Structured navbar link item (preferred over CSV `links`). */
export type NavItem = {
  id: string;
  label: LocalizedString;
  href?: string;
  linkMode?: string;
  linkPageSlug?: string;
  /** Optional per-link style overrides (textColor / fontSize). */
  styles?: { textColor?: string; fontSize?: string };
};

export type ResolvedNavItem = {
  id: string;
  label: string;
  href: string;
  linkMode: string;
  linkPageSlug: string;
  styles?: { textColor?: string; fontSize?: string };
};

/** Atomic edit target inside a composite block (navbar/hero/features/…). */
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

/** @deprecated alias — prefer BlockPart */
export type NavbarPart = BlockPart;

function navId(seed = ""): string {
  const s = seed.replace(/[^a-zA-Z0-9]+/g, "").slice(0, 10) || "item";
  return `nav-${s}-${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeNavItem(item: unknown, index: number): NavItem | null {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const o = item as Record<string, unknown>;
  const label =
    typeof o.label === "string" || isLocalizedMap(o.label)
      ? (o.label as LocalizedString)
      : typeof o.title === "string"
        ? o.title
        : "";
  const stylesRaw = o.styles;
  let styles: NavItem["styles"] | undefined;
  if (stylesRaw && typeof stylesRaw === "object" && !Array.isArray(stylesRaw)) {
    const s = stylesRaw as Record<string, unknown>;
    styles = {
      textColor: typeof s.textColor === "string" ? s.textColor : undefined,
      fontSize: typeof s.fontSize === "string" ? s.fontSize : undefined,
    };
  }
  return {
    id: typeof o.id === "string" && o.id ? o.id : `nav-${index}`,
    label,
    href: typeof o.href === "string" ? o.href : "#",
    linkMode: typeof o.linkMode === "string" ? o.linkMode : "url",
    linkPageSlug: typeof o.linkPageSlug === "string" ? o.linkPageSlug : "",
    ...(styles ? { styles } : {}),
  };
}

/** Migrate CSV `links` (string or LocalizedMap) into structured navItems when missing. */
export function ensureNavItems(props: Record<string, unknown>, locales: string[] = ["ar"]): NavItem[] {
  const existing = props.navItems;
  if (Array.isArray(existing)) {
    return existing.map((it, i) => normalizeNavItem(it, i)).filter((x): x is NavItem => !!x);
  }

  const linksVal = props.links;
  if (isLocalizedMap(linksVal)) {
    const localeKeys = Object.keys(linksVal);
    const primary = locales.find((l) => typeof linksVal[l] === "string") || localeKeys[0] || "ar";
    const primaryLinks = parseCsv(linksVal[primary] || "");
    const maxLen = Math.max(
      primaryLinks.length,
      ...localeKeys.map((loc) => parseCsv(linksVal[loc] || "").length)
    );
    const items: NavItem[] = [];
    for (let i = 0; i < maxLen; i++) {
      const labelMap: LocalizedMap = {};
      for (const loc of localeKeys) {
        const parts = parseCsv(linksVal[loc] || "");
        if (parts[i]) labelMap[loc] = parts[i];
      }
      const fallbackLabel = primaryLinks[i] || Object.values(labelMap)[0] || `Link ${i + 1}`;
      if (!labelMap[primary]) labelMap[primary] = fallbackLabel;
      items.push({
        id: navId(fallbackLabel),
        label: labelMap,
        href: "#",
        linkMode: "url",
        linkPageSlug: "",
      });
    }
    return items;
  }

  return parseCsv(linksVal).map((label, i) => ({
    id: navId(label || String(i)),
    label,
    href: "#",
    linkMode: "url",
    linkPageSlug: "",
  }));
}

export function resolveNavItems(
  props: Record<string, unknown>,
  locale: string,
  fallbackLocale = "ar",
  locales: string[] = ["ar"]
): ResolvedNavItem[] {
  return ensureNavItems(props, locales).map((it) => ({
    id: it.id,
    label: resolveLocalized(it.label, locale, fallbackLocale),
    href: it.href || "#",
    linkMode: it.linkMode || "url",
    linkPageSlug: it.linkPageSlug || "",
    ...(it.styles ? { styles: it.styles } : {}),
  }));
}

export function syncLinksCsvFromNavItems(items: NavItem[], locales: string[]): LocalizedMap {
  const out: LocalizedMap = {};
  const fb = locales[0] || "ar";
  for (const loc of locales) {
    out[loc] = items.map((it) => resolveLocalized(it.label, loc, fb)).filter(Boolean).join(",");
  }
  return out;
}

export function createNavItem(label: LocalizedString = { ar: "رابط", en: "Link" }): NavItem {
  return {
    id: navId(typeof label === "string" ? label : "link"),
    label,
    href: "#",
    linkMode: "url",
    linkPageSlug: "",
  };
}

export function parsePipeItems(raw: unknown): { title: string; body?: string; extra?: string }[] {
  if (typeof raw !== "string") return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((item) => {
      const parts = item.split("|").map((p) => p.trim());
      return { title: parts[0] || item, body: parts[1], extra: parts[2] };
    });
}

export function parsePricingItems(raw: unknown): {
  name: string;
  price: string;
  features: string[];
  highlighted: boolean;
}[] {
  if (typeof raw !== "string") return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((item) => {
      const parts = item.split("|").map((p) => p.trim());
      const name = parts[0] || "خطة";
      const price = parts[1] || "";
      const rest = parts.slice(2);
      const highlighted = rest.some((r) => /شعبية|popular|موصى/i.test(r));
      const features = rest.filter((r) => !/شعبية|popular|موصى/i.test(r));
      return { name, price, features, highlighted };
    });
}

export function parseTestimonials(raw: unknown): { name: string; role: string; quote: string }[] {
  if (typeof raw !== "string") return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((item) => {
      const parts = item.split("|").map((p) => p.trim());
      return { name: parts[0] || "عميل", role: parts[1] || "", quote: parts[2] || parts[1] || "" };
    });
}

export function parseFaq(raw: unknown): { q: string; a: string }[] {
  if (typeof raw !== "string") return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((item) => {
      const [q, a] = item.split("|").map((p) => p.trim());
      return { q: q || item, a: a || "" };
    });
}

export function parseFooterColumns(raw: unknown): { title: string; links: string[] }[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  return raw
    .split("|")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .reduce<{ title: string; links: string[] }[]>((acc, chunk, i, arr) => {
      if (i % 2 === 0) {
        const links = (arr[i + 1] || "")
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean);
        acc.push({ title: chunk, links });
      }
      return acc;
    }, []);
}

export function slugifyPage(input: string) {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^\w\u0600-\u06FF\s-]/g, "")
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || `page-${Date.now().toString(36)}`
  );
}

export function cloneBlock(block: Block, newId: string): Block {
  return { id: newId, type: block.type, props: structuredClone(block.props) };
}
