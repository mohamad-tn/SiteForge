/**
 * In-repo template content for NEW sites — prefers these over stale DB rows
 * so Render does not require a re-seed after shipping template upgrades.
 */
import {
  createBlankContent,
  defaultPropsFor,
  defaultTokens,
  type SiteContent,
} from "@/lib/design";

export function createPortfolioContent(name = "Studio Nova"): SiteContent {
  return {
    tokens: {
      ...defaultTokens,
      colors: {
        primary: "#7c3aed",
        secondary: "#0b1220",
        accent: "#22d3ee",
        background: "#fafafa",
        surface: "#ffffff",
        text: "#0b1220",
        muted: "#57534e",
      },
      colorsDark: {
        primary: "#a78bfa",
        secondary: "#f8fafc",
        accent: "#22d3ee",
        background: "#030712",
        surface: "#0b1220",
        text: "#f8fafc",
        muted: "#94a3b8",
      },
      fonts: { heading: "Poppins", body: "Inter" },
      spacing: { sectionY: 96, blockGap: 32, contentMaxWidth: 1160 },
      radius: 28,
      themeMode: "system",
      rtl: true,
    },
    locales: ["ar", "en"],
    defaultLocale: "ar",
    components: [],
    pages: [
      {
        id: "page-home",
        title: "الأعمال",
        slug: "home",
        layout: "canvas",
        blocks: [
          {
            id: "pf-nav",
            type: "navbar",
            props: {
              ...defaultPropsFor("navbar"),
              brand: { ar: name, en: name },
              links: { ar: "أعمال,خدمات,أسعار,تواصل", en: "Work,Services,Pricing,Contact" },
              ctaLabel: { ar: "ابدأ مشروعك", en: "Start a project" },
              ctaHref: "#contact",
              sticky: "true",
              bgColor: "#ffffff",
              textColor: "#0b1220",
            },
          },
          {
            id: "pf-hero",
            type: "hero",
            props: {
              ...defaultPropsFor("hero"),
              eyebrow: { ar: "استوديو منتج · تصميم وتطوير", en: "Product studio · Design & engineering" },
              headline: {
                ar: "نبني واجهات تبدو كمنتج جاهز للبيع",
                en: "We craft interfaces that feel sale-ready",
              },
              subheadline: {
                ar: "هوية، مواقع، ومنتجات رقمية بعمق بصري هادئ — تباين آمن، إيقاع واضح، ونسخ حقيقية بالعربي والإنجليزي.",
                en: "Brand, sites, and digital products with quiet depth — contrast-safe chrome, clear rhythm, and real AR+EN copy.",
              },
              ctaLabel: { ar: "احجز مكالمة", en: "Book a call" },
              secondaryLabel: { ar: "استعرض الأعمال", en: "Browse work" },
              effectPreset: "blur-in",
              entranceAnim: "blur-in",
              animDuration: "800",
              paddingY: "110",
            },
          },
          {
            id: "pf-gallery",
            type: "gallery",
            props: {
              ...defaultPropsFor("gallery"),
              title: { ar: "مشاريع مختارة", en: "Selected work" },
              subtitle: { ar: "من الهوية إلى المنتج الكامل", en: "From brand systems to full products" },
              items: {
                ar: "متجر أزياء|تجارة إلكترونية بهوية جريئة,تطبيق صحة|منتج موبايل بهدوء سريري,هوية بصرية|نظام علامات عبر ست قنوات,منصة تعليم|SaaS متعدد المستأجرين",
                en: "Fashion store|Commerce with bold identity,Health app|Mobile product with clinical calm,Brand identity|Mark system across six channels,Edu platform|Multi-tenant SaaS",
              },
              columns: "4",
              effectPreset: "scale-in",
              entranceAnim: "scale",
              scrollReveal: "true",
            },
          },
          {
            id: "pf-features",
            type: "features",
            props: {
              ...defaultPropsFor("features"),
              title: { ar: "ماذا نقدّم", en: "What we offer" },
              subtitle: { ar: "فريق صغير · جودة عالية · تسليم واضح", en: "Small team · High craft · Clear delivery" },
              items: {
                ar: "تصميم UI|واجهات حديثة بتسلسل بصري قوي,تطوير|مواقع سريعة ومتجاوبة مع Next.js,هوية|لغة بصرية متسقة عبر كل نقطة تواصل",
                en: "UI design|Modern interfaces with strong hierarchy,Development|Fast responsive sites on Next.js,Identity|Consistent visual language everywhere",
              },
              effectPreset: "lift-hover",
              hoverScale: "md",
              hoverShadow: "true",
              scrollReveal: "true",
            },
          },
          {
            id: "pf-stats",
            type: "stats",
            props: {
              ...defaultPropsFor("stats"),
              title: { ar: "أرقام نفتخر بها", en: "Numbers we stand behind" },
              items: {
                ar: "48|مشروعاً مُسلّماً,12|علامة أُعيد بناؤها,4.9★|متوسط تقييم العملاء,6|أسابيع متوسط التسليم",
                en: "48|Projects shipped,12|Brands rebuilt,4.9★|Avg client rating,6|Weeks median delivery",
              },
              effectPreset: "soft-fade",
              entranceAnim: "fade",
              scrollReveal: "true",
            },
          },
          {
            id: "pf-testimonials",
            type: "testimonials",
            props: {
              ...defaultPropsFor("testimonials"),
              title: { ar: "شركاء يتحدثون بصوت عالٍ", en: "Partners who speak loudly" },
              items: {
                ar: "ليان خ.|مديرة منتج|سلّموا موقعاً بدا وكأنه تمويل سلسلة A — قبل أن نجمع التمويل.,عمر ف.|مؤسس|العربية ليست ترجمة لاحقة هنا؛ هي الطبقة الأولى.,ميا ر.|رئيسة تصميم|الإيقاع والتباين يذكران بـ Framer المدفوع دون تعقيد الأداة.",
                en: "Lyan K.|Product lead|They shipped a site that felt Series-A ready — before we raised.,Omar F.|Founder|Arabic isn't an afterthought here; it's the first layer.,Mia R.|Design head|Rhythm and contrast recall paid Framer without the tool tax.",
              },
              effectPreset: "soft-fade",
              entranceAnim: "fade",
              scrollReveal: "true",
            },
          },
          {
            id: "pf-pricing",
            type: "pricing",
            props: {
              ...defaultPropsFor("pricing"),
              title: { ar: "شراكات واضحة", en: "Clear engagements" },
              subtitle: {
                ar: "أسعار ثابتة · نطاق مكتوب · مراجعات أسبوعية",
                en: "Fixed fees · Written scope · Weekly reviews",
              },
              items: {
                ar: "إطلاق|٤٬٨٠٠$|صفحة هبوط + هوية خفيفة|نسختان AR/EN|تسليم ١٤ يوماً,استوديو|٩٬٢٠٠$|موقع متعدد الصفحات|نظام مكوّنات|دعم ٣٠ يوماً|الأكثر اختياراً,شراكة|حسب النطاق|منتج مستمر|فريق مدمج|SLA شهري",
                en: "Launch|$4,800|Landing + light identity|AR/EN copy|14-day delivery,Studio|$9,200|Multi-page site|Component system|30-day support|Most chosen,Partner|Custom|Ongoing product|Embedded team|Monthly SLA",
              },
              effectPreset: "slide-up",
              entranceAnim: "slide-up",
              scrollReveal: "true",
            },
          },
          {
            id: "pf-cta",
            type: "cta",
            props: {
              ...defaultPropsFor("cta"),
              title: { ar: "جاهز لرفع مستوى حضورك الرقمي؟", en: "Ready to elevate your digital presence?" },
              body: {
                ar: "نبدأ بجلسة اكتشاف قصيرة ونخرج بخطة واضحة — بلا لوريم.",
                en: "We start with a short discovery call and a clear plan — no lorem.",
              },
              buttonLabel: { ar: "احجز مكالمة", en: "Book a call" },
              bgColor: "#7c3aed",
              textColor: "#ffffff",
            },
          },
          {
            id: "pf-contact",
            type: "contact",
            props: {
              ...defaultPropsFor("contact"),
              email: "hello@studio.example",
              phone: "+963 111 222 333",
              address: { ar: "عن بُعد / دمشق", en: "Remote / Damascus" },
            },
          },
          {
            id: "pf-footer",
            type: "footer",
            props: {
              ...defaultPropsFor("footer"),
              brand: { ar: name, en: name },
              text: { ar: `© 2026 ${name} — صُنع للتميّز`, en: `© 2026 ${name} — built for craft` },
              bgColor: "#0b1220",
              textColor: "#f8fafc",
              links: { ar: "أعمال,خصوصية,تواصل", en: "Work,Privacy,Contact" },
            },
          },
        ],
      },
    ],
  };
}

export function createCvContent(name = "أحمد علي"): SiteContent {
  const enName = name === "أحمد علي" ? "Ahmad Ali" : name;
  return {
    tokens: {
      ...defaultTokens,
      colors: {
        primary: "#0d9488",
        secondary: "#0f172a",
        accent: "#2dd4bf",
        background: "#f8fafc",
        surface: "#ffffff",
        text: "#0f172a",
        muted: "#57534e",
      },
      colorsDark: {
        primary: "#2dd4bf",
        secondary: "#e2e8f0",
        accent: "#5eead4",
        background: "#020617",
        surface: "#0f172a",
        text: "#f8fafc",
        muted: "#94a3b8",
      },
      fonts: { heading: "Cairo", body: "Cairo" },
      spacing: { sectionY: 88, blockGap: 28, contentMaxWidth: 1100 },
      radius: 22,
      themeMode: "system",
      rtl: true,
    },
    locales: ["ar", "en"],
    defaultLocale: "ar",
    components: [],
    pages: [
      {
        id: "page-home",
        title: "السيرة",
        slug: "home",
        layout: "canvas",
        blocks: [
          {
            id: "cv-nav",
            type: "navbar",
            props: {
              ...defaultPropsFor("navbar"),
              brand: { ar: name, en: enName },
              links: { ar: "نبذة,خبرات,تواصل", en: "About,Experience,Contact" },
              ctaLabel: { ar: "حمّل السيرة", en: "Download CV" },
              ctaHref: "#contact",
              sticky: "true",
              bgColor: "#ffffff",
              textColor: "#0f172a",
            },
          },
          {
            id: "cv-hero",
            type: "hero",
            props: {
              ...defaultPropsFor("hero"),
              eyebrow: { ar: "متاح للعمل · دمشق / عن بُعد", en: "Open to work · Damascus / Remote" },
              headline: {
                ar: "مهندس برمجيات يبني منتجات سريعة وواضحة",
                en: "Software engineer building fast, clear products",
              },
              subheadline: {
                ar: "Next.js · TypeScript · أنظمة تصميم. أحوّل الأفكار المعقّدة إلى تجارب بسيطة يثق بها المستخدم.",
                en: "Next.js · TypeScript · design systems. I turn complex ideas into simple experiences people trust.",
              },
              ctaLabel: { ar: "تواصل معي", en: "Get in touch" },
              ctaHref: "#contact",
              effectPreset: "slide-up",
              entranceAnim: "slide-up",
              paddingY: "96",
            },
          },
          {
            id: "cv-features",
            type: "features",
            props: {
              ...defaultPropsFor("features"),
              title: { ar: "مجالات التميّز", en: "Where I shine" },
              items: {
                ar: "Frontend|React, Next.js, TypeScript,Backend|Node, Prisma, PostgreSQL,Design Systems|Figma، رموز، مكوّنات قابلة لإعادة الاستخدام",
                en: "Frontend|React, Next.js, TypeScript,Backend|Node, Prisma, PostgreSQL,Design Systems|Figma, tokens, reusable components",
              },
              effectPreset: "lift-hover",
              hoverScale: "md",
              hoverShadow: "true",
              scrollReveal: "true",
            },
          },
          {
            id: "cv-contact",
            type: "contact",
            props: {
              ...defaultPropsFor("contact"),
              title: { ar: "لنبدأ حواراً", en: "Let's talk" },
              email: "ahmad@example.com",
            },
          },
          {
            id: "cv-footer",
            type: "footer",
            props: {
              ...defaultPropsFor("footer"),
              brand: { ar: name, en: enName },
              text: { ar: `© 2026 ${name} — صُنع بعناية`, en: `© 2026 ${enName} — crafted with care` },
              bgColor: "#0f172a",
              textColor: "#f8fafc",
            },
          },
        ],
      },
    ],
  };
}

/** Prefer in-repo content for known slugs so new sites skip stale DB JSON. */
export function builtinTemplateContent(slug: string, siteName?: string): SiteContent | null {
  switch (slug) {
    case "blank":
      return createBlankContent(siteName || "موقعي الجديد");
    case "portfolio":
      return createPortfolioContent(siteName || "Studio Nova");
    case "cv":
      return createCvContent(siteName || "أحمد علي");
    default:
      return null;
  }
}
