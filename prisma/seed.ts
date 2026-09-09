import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import type { SiteContent } from "../src/lib/design";
import {
  createBlankContent,
  defaultDarkColors,
  defaultPropsFor,
  defaultTokens,
} from "../src/lib/design";

const prisma = new PrismaClient();

function tokens(partial: any = {}) {
  return {
    ...defaultTokens,
    ...partial,
    colors: { ...defaultTokens.colors, ...(partial.colors || {}) },
    colorsDark: { ...defaultDarkColors, ...(partial.colorsDark || {}) },
    fonts: { ...defaultTokens.fonts, ...(partial.fonts || {}) },
    spacing: { ...defaultTokens.spacing, ...(partial.spacing || {}) },
    themeMode: partial.themeMode || "system",
    radius: partial.radius ?? 24,
  };
}

const templates: {
  slug: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  category: string;
  content: any;
}[] = [
  {
    slug: "blank",
    name: "Blank",
    nameAr: "فارغ",
    description: "Start from a clean canvas",
    descriptionAr: "ابدأ من لوحة نظيفة مع لغتين",
    category: "blank",
    content: createBlankContent("موقعي الجديد"),
  },
  {
    slug: "cv",
    name: "CV / Resume",
    nameAr: "سيرة ذاتية",
    description: "Polished personal CV with modern depth",
    descriptionAr: "سيرة ذاتية أنيقة بعمق بصري حديث",
    category: "cv",
    content: {
      tokens: tokens({
        colors: {
          primary: "#0d9488",
          secondary: "#0f172a",
          accent: "#2dd4bf",
          background: "#f8fafc",
          surface: "#ffffff",
          text: "#0f172a",
          muted: "#64748b",
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
      }),
      locales: ["ar", "en", "fr"],
      defaultLocale: "ar",
      pages: [
        {
          id: "page-home",
          title: "السيرة",
          slug: "home",
          blocks: [
            {
              id: "cv-nav",
              type: "navbar",
              props: {
                ...defaultPropsFor("navbar"),
                brand: { ar: "أحمد علي", en: "Ahmad Ali", fr: "Ahmad Ali" },
                links: { ar: "نبذة,خبرات,تواصل", en: "About,Experience,Contact", fr: "À propos,Expérience,Contact" },
                ctaLabel: { ar: "حمّل السيرة", en: "Download CV", fr: "Télécharger" },
                ctaHref: "#contact",
                sticky: "true",
              },
            },
            {
              id: "cv-hero",
              type: "hero",
              props: {
                ...defaultPropsFor("hero"),
                eyebrow: { ar: "متاح للعمل · دمشق / عن بُعد", en: "Open to work · Damascus / Remote", fr: "Disponible · Damas / Remote" },
                headline: {
                  ar: "مهندس برمجيات يبني منتجات سريعة وواضحة",
                  en: "Software engineer building fast, clear products",
                  fr: "Ingénieur logiciel — produits rapides et clairs",
                },
                subheadline: {
                  ar: "Next.js · TypeScript · أنظمة تصميم. أحوّل الأفكار المعقّدة إلى تجارب بسيطة يثق بها المستخدم.",
                  en: "Next.js · TypeScript · design systems. I turn complex ideas into simple experiences people trust.",
                  fr: "Next.js · TypeScript · design systems.",
                },
                ctaLabel: { ar: "تواصل معي", en: "Get in touch", fr: "Me contacter" },
                ctaHref: "#contact",
                secondaryLabel: { ar: "شاهد الأعمال", en: "See work", fr: "Voir les projets" },
                secondaryHref: "/projects",
                effectPreset: "slide-up",
                entranceAnim: "slide-up",
                scrollReveal: "false",
                animDuration: "700",
                paddingY: "96",
              },
            },
            {
              id: "cv-stats",
              type: "stats",
              props: {
                ...defaultPropsFor("stats"),
                title: { ar: "أثر قابل للقياس", en: "Measurable impact", fr: "Impact mesurable" },
                items: {
                  ar: "40+|منتج أُطلق,12|عميل نشط,5+|سنوات خبرة,99.9%|توفّر",
                  en: "40+|Products shipped,12|Active clients,5+|Years experience,99.9%|Uptime",
                  fr: "40+|Produits,12|Clients,5+|Ans,99.9%|Dispo",
                },
                effectPreset: "soft-fade",
                entranceAnim: "fade",
                scrollReveal: "true",
              },
            },
            {
              id: "cv-features",
              type: "features",
              props: {
                ...defaultPropsFor("features"),
                title: { ar: "مجالات التميّز", en: "Where I shine", fr: "Expertises" },
                subtitle: { ar: "أدوات وممارسات أستخدمها يومياً", en: "Tools and practices I use every day", fr: "Outils du quotidien" },
                items: {
                  ar: "Frontend|React, Next.js, TypeScript, واجهات دقيقة,Backend|Node, Prisma, PostgreSQL, APIs آمنة,Design Systems|Figma، رموز تصميم، مكوّنات قابلة لإعادة الاستخدام",
                  en: "Frontend|React, Next.js, TypeScript, precise UI,Backend|Node, Prisma, PostgreSQL, secure APIs,Design Systems|Figma, tokens, reusable components",
                  fr: "Frontend|React, Next.js, TypeScript,Backend|Node, Prisma, PostgreSQL,Design Systems|Figma & composants",
                },
                columns: "3",
                effectPreset: "lift-hover",
                entranceAnim: "none",
                hoverScale: "md",
                hoverShadow: "true",
                scrollReveal: "true",
              },
            },
            {
              id: "cv-list",
              type: "list",
              props: {
                ...defaultPropsFor("list"),
                title: { ar: "أبرز الإنجازات", en: "Highlights", fr: "Points forts" },
                items: {
                  ar: "إطلاق منصة متعددة المستأجرين تخدم آلاف المستخدمين,تحسين أداء الواجهة بنسبة 40% عبر تقسيم الحزم والصور,قيادة فريق من 4 مهندسين مع مراجعات تصميم مشتركة",
                  en: "Shipped a multi-tenant platform serving thousands of users,Improved UI performance by 40% with code-splitting & images,Led a team of 4 engineers with shared design reviews",
                  fr: "Plateforme multi-tenant,Performance UI +40%,Équipe de 4 ingénieurs",
                },
                style: "check",
                effectPreset: "soft-fade",
                entranceAnim: "fade",
                scrollReveal: "true",
              },
            },
            {
              id: "cv-contact",
              type: "contact",
              props: {
                ...defaultPropsFor("contact"),
                title: { ar: "لنبدأ حواراً", en: "Let's talk", fr: "Parlons" },
                email: "ahmad@example.com",
                phone: "+963 999 000 111",
                address: { ar: "دمشق · متاح عن بُعد", en: "Damascus · Remote-friendly", fr: "Damas · Remote" },
              },
            },
            {
              id: "cv-footer",
              type: "footer",
              props: {
                ...defaultPropsFor("footer"),
                brand: { ar: "أحمد علي", en: "Ahmad Ali", fr: "Ahmad Ali" },
                text: { ar: "© 2026 أحمد علي — صُنع بعناية", en: "© 2026 Ahmad Ali — crafted with care", fr: "© 2026 Ahmad Ali" },
                links: { ar: "LinkedIn,GitHub,Email", en: "LinkedIn,GitHub,Email", fr: "LinkedIn,GitHub,Email" },
              },
            },
          ],
        },
        {
          id: "page-projects",
          title: "المشاريع",
          slug: "projects",
          blocks: [
            {
              id: "cv-p-h",
              type: "heading",
              props: {
                text: { ar: "مشاريع مختارة", en: "Selected projects", fr: "Projets sélectionnés" },
                level: "h1",
                align: "center",
                effectPreset: "soft-fade",
                entranceAnim: "fade",
              },
            },
            {
              id: "cv-p-g",
              type: "gallery",
              props: {
                ...defaultPropsFor("gallery"),
                title: { ar: "أعمال حديثة", en: "Recent work", fr: "Travaux récents" },
                subtitle: { ar: "من المنصات إلى لوحات التحكم", en: "From platforms to dashboards", fr: "Plateformes & dashboards" },
                items: {
                  ar: "منصة SaaS|2025,متجر متعدد اللغات|2024,لوحة تحكم تحليلات|2024",
                  en: "SaaS platform|2025,Multilingual store|2024,Analytics dashboard|2024",
                  fr: "Plateforme SaaS|2025,Boutique|2024,Tableau de bord|2024",
                },
                columns: "3",
                effectPreset: "scale-in",
                entranceAnim: "scale",
                scrollReveal: "true",
              },
            },
          ],
        },
      ],
    },
  },
  {
    slug: "portfolio",
    name: "Portfolio",
    nameAr: "معرض أعمال",
    description: "Studio portfolio with GitHub-marketing depth",
    descriptionAr: "معرض استوديو بعمق بصري يشبه صفحات GitHub",
    category: "portfolio",
    content: {
      tokens: tokens({
        colors: {
          primary: "#7c3aed",
          secondary: "#0b1220",
          accent: "#22d3ee",
          background: "#fafafa",
          surface: "#ffffff",
          text: "#0b1220",
          muted: "#64748b",
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
      }),
      locales: ["ar", "en", "es"],
      defaultLocale: "ar",
      pages: [
        {
          id: "page-home",
          title: "الأعمال",
          slug: "home",
          blocks: [
            {
              id: "pf-nav",
              type: "navbar",
              props: {
                ...defaultPropsFor("navbar"),
                brand: { ar: "Studio Nova", en: "Studio Nova", es: "Studio Nova" },
                links: { ar: "أعمال,خدمات,أسعار,تواصل", en: "Work,Services,Pricing,Contact", es: "Trabajo,Servicios,Precios,Contacto" },
                ctaLabel: { ar: "ابدأ مشروعك", en: "Start a project", es: "Empezar proyecto" },
                ctaHref: "#contact",
                sticky: "true",
              },
            },
            {
              id: "pf-hero",
              type: "hero",
              props: {
                ...defaultPropsFor("hero"),
                eyebrow: { ar: "استوديو منتج · تصميم وتطوير", en: "Product studio · Design & engineering", es: "Studio de producto" },
                headline: {
                  ar: "نبني واجهات تبدو كمنتج جاهز للبيع",
                  en: "We craft interfaces that feel sale-ready",
                  es: "Interfaces listas para vender",
                },
                subheadline: {
                  ar: "هوية، مواقع، ومنتجات رقمية بعمق بصري هادئ — أسود عميق، تدرجات ناعمة، وتفاصيل تُشبه صفحات GitHub التسويقية.",
                  en: "Brand, sites, and digital products with quiet depth — deep blacks, soft gradients, and GitHub-marketing polish.",
                  es: "Marca, sitios y productos con profundidad visual.",
                },
                ctaLabel: { ar: "احجز مكالمة", en: "Book a call", es: "Reservar llamada" },
                secondaryLabel: { ar: "استعرض الأعمال", en: "Browse work", es: "Ver trabajos" },
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
                title: { ar: "مشاريع مختارة", en: "Selected work", es: "Trabajos" },
                subtitle: { ar: "من الهوية إلى المنتج الكامل", en: "From brand systems to full products", es: "De marca a producto" },
                items: {
                  ar: "متجر أزياء|تجارة,تطبيق صحة|منتج,هوية بصرية|علامة,منصة تعليم|SaaS",
                  en: "Fashion store|Commerce,Health app|Product,Brand identity|Brand,Edu platform|SaaS",
                  es: "Tienda moda|Commerce,App salud|Producto,Identidad|Marca,Edu|SaaS",
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
                title: { ar: "ماذا نقدّم", en: "What we offer", es: "Qué ofrecemos" },
                subtitle: { ar: "فريق صغير · جودة عالية · تسليم واضح", en: "Small team · High craft · Clear delivery", es: "Equipo pequeño · Alta calidad" },
                items: {
                  ar: "تصميم UI|واجهات حديثة بتسلسل بصري قوي,تطوير|مواقع سريعة ومتجاوبة مع Next.js,هوية|لغة بصرية متسقة عبر كل نقطة تواصل",
                  en: "UI design|Modern interfaces with strong hierarchy,Development|Fast responsive sites on Next.js,Identity|Consistent visual language everywhere",
                  es: "UI|Interfaces modernas,Desarrollo|Sitios rápidos,Identidad|Lenguaje visual",
                },
                effectPreset: "lift-hover",
                hoverScale: "md",
                hoverShadow: "true",
                scrollReveal: "true",
              },
            },
            {
              id: "pf-testimonials",
              type: "testimonials",
              props: {
                ...defaultPropsFor("testimonials"),
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
                effectPreset: "slide-up",
                entranceAnim: "slide-up",
                scrollReveal: "true",
              },
            },
            {
              id: "pf-faq",
              type: "faq",
              props: {
                ...defaultPropsFor("faq"),
                effectPreset: "soft-fade",
                entranceAnim: "fade",
                scrollReveal: "true",
              },
            },
            {
              id: "pf-cta",
              type: "cta",
              props: {
                ...defaultPropsFor("cta"),
                title: { ar: "جاهز لرفع مستوى حضورك الرقمي؟", en: "Ready to elevate your digital presence?", es: "¿Listo para elevar tu presencia?" },
                subtitle: { ar: "نبدأ بجلسة اكتشاف قصيرة ونخرج بخطة واضحة.", en: "We start with a short discovery call and a clear plan.", es: "Empezamos con una llamada corta." },
                effectPreset: "glow-hover",
                hoverShadow: "glow",
              },
            },
            {
              id: "pf-contact",
              type: "contact",
              props: {
                ...defaultPropsFor("contact"),
                email: "hello@studio.example",
                phone: "+963 111 222 333",
                address: { ar: "عن بُعد / دمشق", en: "Remote / Damascus", es: "Remoto / Damasco" },
              },
            },
            {
              id: "pf-footer",
              type: "footer",
              props: {
                ...defaultPropsFor("footer"),
                brand: { ar: "Studio Nova", en: "Studio Nova", es: "Studio Nova" },
                text: { ar: "© 2026 Studio Nova — صُنع للتميّز", en: "© 2026 Studio Nova — built for craft", es: "© 2026 Studio Nova" },
              },
            },
          ],
        },
      ],
    },
  },
  {
    slug: "landing",
    name: "Product Landing",
    nameAr: "صفحة هبوط",
    description: "SaaS landing with teal/violet accents",
    descriptionAr: "هبوط منتج بألوان فيروزي/بنفسجي حديثة",
    category: "landing",
    content: {
      tokens: tokens({
        colors: {
          primary: "#0891b2",
          secondary: "#0c1222",
          accent: "#8b5cf6",
          background: "#f8fafc",
          surface: "#ffffff",
          text: "#0c1222",
          muted: "#64748b",
        },
        colorsDark: {
          primary: "#22d3ee",
          secondary: "#f1f5f9",
          accent: "#a78bfa",
          background: "#020617",
          surface: "#0b1220",
          text: "#f8fafc",
          muted: "#94a3b8",
        },
        fonts: { heading: "Inter", body: "Inter" },
        spacing: { sectionY: 92, blockGap: 28, contentMaxWidth: 1120 },
        radius: 24,
        themeMode: "system",
      }),
      locales: ["ar", "en", "fr", "es"],
      defaultLocale: "ar",
      pages: [
        {
          id: "page-home",
          title: "الرئيسية",
          slug: "home",
          blocks: [
            {
              id: "ld-nav",
              type: "navbar",
              props: {
                ...defaultPropsFor("navbar"),
                brand: { ar: "SiteForge", en: "SiteForge", fr: "SiteForge", es: "SiteForge" },
                links: {
                  ar: "المزايا,التسعير,الأسئلة",
                  en: "Features,Pricing,FAQ",
                  fr: "Fonctionnalités,Tarifs,FAQ",
                  es: "Funciones,Precios,FAQ",
                },
                ctaLabel: { ar: "ابدأ مجاناً", en: "Start free", fr: "Commencer", es: "Empezar gratis" },
                ctaHref: "/signup",
                sticky: "true",
              },
            },
            {
              id: "ld-hero",
              type: "hero",
              props: {
                ...defaultPropsFor("hero"),
                eyebrow: { ar: "منصة مواقع متعددة المستأجرين", en: "Multi-tenant site platform", fr: "Plateforme multi-tenant", es: "Plataforma multi-tenant" },
                headline: {
                  ar: "أطلق موقعاً احترافياً في دقائق لا أسابيع",
                  en: "Launch a polished site in minutes, not weeks",
                  fr: "Lancez un site soigné en minutes",
                  es: "Lanza un sitio pulido en minutos",
                },
                subheadline: {
                  ar: "محرر بصري، قوالب جاهزة، تأثيرات بسيطة، ونشر بنقرة — بواجهة عربية وإنجليزية.",
                  en: "Visual editor, ready templates, simple effects, one-click publish — Arabic & English UI.",
                  fr: "Éditeur visuel, modèles, effets simples, publication en un clic.",
                  es: "Editor visual, plantillas, efectos simples, publicar en un clic.",
                },
                ctaLabel: { ar: "جرّب الآن", en: "Try it now", fr: "Essayer", es: "Probar ahora" },
                ctaHref: "/signup",
                secondaryLabel: { ar: "شاهد العرض", en: "See demo", fr: "Voir la démo", es: "Ver demo" },
                secondaryHref: "/s/demo-studio",
                effectPreset: "float",
                entranceAnim: "float",
                animDuration: "900",
                paddingY: "108",
              },
            },
            {
              id: "ld-stats",
              type: "stats",
              props: {
                ...defaultPropsFor("stats"),
                title: { ar: "أرقام تثق بها الفرق", en: "Numbers teams trust", fr: "Chiffres de confiance", es: "Números de confianza" },
                items: {
                  ar: "10×|أسرع للإطلاق,50+|قالب وقسم,4|لغات محتوى,99.9%|توفّر",
                  en: "10×|Faster to launch,50+|Sections & templates,4|Content locales,99.9%|Uptime",
                  fr: "10×|Plus rapide,50+|Sections,4|Langues,99.9%|Dispo",
                  es: "10×|Más rápido,50+|Secciones,4|Idiomas,99.9%|Uptime",
                },
                effectPreset: "soft-fade",
                entranceAnim: "fade",
                scrollReveal: "true",
              },
            },
            {
              id: "ld-features",
              type: "features",
              props: {
                ...defaultPropsFor("features"),
                title: { ar: "كل ما تحتاجه للإطلاق", en: "Everything you need to ship", fr: "Tout pour publier", es: "Todo para lanzar" },
                effectPreset: "lift-hover",
                hoverScale: "md",
                hoverShadow: "true",
                scrollReveal: "true",
              },
            },
            {
              id: "ld-pricing",
              type: "pricing",
              props: {
                ...defaultPropsFor("pricing"),
                effectPreset: "slide-up",
                entranceAnim: "slide-up",
                scrollReveal: "true",
              },
            },
            {
              id: "ld-testimonials",
              type: "testimonials",
              props: {
                ...defaultPropsFor("testimonials"),
                effectPreset: "soft-fade",
                entranceAnim: "fade",
                scrollReveal: "true",
              },
            },
            {
              id: "ld-faq",
              type: "faq",
              props: {
                ...defaultPropsFor("faq"),
                effectPreset: "soft-fade",
                entranceAnim: "fade",
                scrollReveal: "true",
              },
            },
            {
              id: "ld-cta",
              type: "cta",
              props: {
                ...defaultPropsFor("cta"),
                buttonHref: "/signup",
                title: { ar: "ابدأ موقعك اليوم", en: "Start your site today", fr: "Commencez aujourd'hui", es: "Empieza hoy" },
                effectPreset: "glow-hover",
                hoverShadow: "glow",
              },
            },
            {
              id: "ld-footer",
              type: "footer",
              props: {
                ...defaultPropsFor("footer"),
                brand: { ar: "SiteForge", en: "SiteForge", fr: "SiteForge", es: "SiteForge" },
              },
            },
          ],
        },
      ],
    },
  },
  {
    slug: "business",
    name: "Business",
    nameAr: "أعمال / شركة",
    description: "Corporate site with warm amber & deep slate",
    descriptionAr: "موقع شركة بألوان كهرمانية وأردواز عميق",
    category: "business",
    content: {
      tokens: tokens({
        colors: {
          primary: "#b45309",
          secondary: "#1c1917",
          accent: "#f59e0b",
          background: "#fffbeb",
          surface: "#ffffff",
          text: "#1c1917",
          muted: "#78716c",
        },
        colorsDark: {
          primary: "#fbbf24",
          secondary: "#fafaf9",
          accent: "#f59e0b",
          background: "#0c0a09",
          surface: "#1c1917",
          text: "#fafaf9",
          muted: "#a8a29e",
        },
        fonts: { heading: "Tajawal", body: "Tajawal" },
        spacing: { sectionY: 84, blockGap: 26, contentMaxWidth: 1100 },
        radius: 20,
        themeMode: "system",
      }),
      locales: ["ar", "en"],
      defaultLocale: "ar",
      pages: [
        {
          id: "page-home",
          title: "الرئيسية",
          slug: "home",
          blocks: [
            {
              id: "bz-nav",
              type: "navbar",
              props: {
                ...defaultPropsFor("navbar"),
                brand: { ar: "مؤسسة النور", en: "Al-Noor Co." },
                links: { ar: "خدماتنا,من نحن,الأسئلة,تواصل", en: "Services,About,FAQ,Contact" },
                ctaLabel: { ar: "احجز استشارة", en: "Book a consult" },
                ctaHref: "#contact",
                sticky: "true",
              },
            },
            {
              id: "bz-hero",
              type: "hero",
              props: {
                ...defaultPropsFor("hero"),
                eyebrow: { ar: "استشارات وتشغيل منذ 2014", en: "Advisory & operations since 2014" },
                headline: {
                  ar: "حلول موثوقة لنمو أعمالك بثقة",
                  en: "Trusted solutions for confident growth",
                },
                subheadline: {
                  ar: "نرافق الشركات المحلية بخدمات استشارية وتشغيلية واضحة — قياس للنتائج وشراكة طويلة الأمد.",
                  en: "We support local companies with clear consulting and operations — measurable outcomes and long-term partnership.",
                },
                ctaLabel: { ar: "تحدّث إلينا", en: "Talk to us" },
                secondaryLabel: { ar: "تعرّف على خدماتنا", en: "Explore services" },
                secondaryHref: "#services",
                effectPreset: "slide-up",
                entranceAnim: "slide-up",
                paddingY: "100",
              },
            },
            {
              id: "bz-features",
              type: "features",
              props: {
                ...defaultPropsFor("features"),
                title: { ar: "خدماتنا", en: "Our services" },
                subtitle: { ar: "حزم عملية تناسب الشركات الصغيرة والمتوسطة", en: "Practical packages for growing SMEs" },
                effectPreset: "lift-hover",
                hoverScale: "md",
                hoverShadow: "true",
                scrollReveal: "true",
              },
            },
            {
              id: "bz-columns",
              type: "columns",
              props: {
                ...defaultPropsFor("columns"),
                leftTitle: { ar: "من نحن", en: "About us" },
                leftBody: {
                  ar: "فريق محلي بخبرة عملية في السوق السوري والإقليمي — نفضّل الوضوح على الشعارات.",
                  en: "A local team with practical regional experience — we prefer clarity over slogans.",
                },
                rightTitle: { ar: "نهجنا", en: "Our approach" },
                rightBody: {
                  ar: "تشخيص قصير، خطة قابلة للتنفيذ، ومتابعة شهرية بالأرقام.",
                  en: "Short diagnosis, an actionable plan, and monthly follow-up with numbers.",
                },
                ratio: "50/50",
                effectPreset: "soft-fade",
                entranceAnim: "fade",
                scrollReveal: "true",
              },
            },
            {
              id: "bz-divider",
              type: "divider",
              props: { style: "solid", label: { ar: "لماذا النور", en: "Why Al-Noor" } },
            },
            {
              id: "bz-list",
              type: "list",
              props: {
                ...defaultPropsFor("list"),
                title: { ar: "التزاماتنا", en: "Our commitments" },
                items: {
                  ar: "شفافية في التسعير والجدول الزمني,تقارير شهرية مفهومة للإدارة,دعم سريع عبر واتساب والبريد",
                  en: "Transparent pricing and timelines,Monthly reports leadership can read,Fast support via WhatsApp and email",
                },
                style: "check",
                effectPreset: "soft-fade",
                entranceAnim: "fade",
                scrollReveal: "true",
              },
            },
            {
              id: "bz-faq",
              type: "faq",
              props: {
                ...defaultPropsFor("faq"),
                effectPreset: "soft-fade",
                entranceAnim: "fade",
                scrollReveal: "true",
              },
            },
            {
              id: "bz-contact",
              type: "contact",
              props: {
                ...defaultPropsFor("contact"),
                email: "info@alnoor.example",
                phone: "+963 11 000 0000",
                address: { ar: "دمشق — المالكي", en: "Damascus — Malki" },
              },
            },
            {
              id: "bz-footer",
              type: "footer",
              props: {
                ...defaultPropsFor("footer"),
                brand: { ar: "مؤسسة النور", en: "Al-Noor Co." },
                text: { ar: "© 2026 مؤسسة النور", en: "© 2026 Al-Noor Co." },
              },
            },
          ],
        },
      ],
    },
  },
  {
    slug: "restaurant",
    name: "Restaurant",
    nameAr: "مطعم",
    description: "Warm restaurant landing with rich oranges",
    descriptionAr: "صفحة مطعم دافئة بألوان برتقالية غنية",
    category: "restaurant",
    content: {
      tokens: tokens({
        colors: {
          primary: "#c2410c",
          secondary: "#431407",
          accent: "#fb923c",
          background: "#fff7ed",
          surface: "#ffffff",
          text: "#431407",
          muted: "#9a3412",
        },
        colorsDark: {
          primary: "#fb923c",
          secondary: "#ffedd5",
          accent: "#fdba74",
          background: "#1c0a05",
          surface: "#2a120a",
          text: "#fff7ed",
          muted: "#fdba74",
        },
        fonts: { heading: "Cairo", body: "Cairo" },
        spacing: { sectionY: 80, blockGap: 24, contentMaxWidth: 1080 },
        radius: 28,
        themeMode: "system",
      }),
      locales: ["ar", "en", "fr"],
      defaultLocale: "ar",
      pages: [
        {
          id: "page-home",
          title: "الرئيسية",
          slug: "home",
          blocks: [
            {
              id: "rs-nav",
              type: "navbar",
              props: {
                ...defaultPropsFor("navbar"),
                brand: { ar: "نارنج", en: "Naranj", fr: "Naranj" },
                links: { ar: "القائمة,أجواء,حجز", en: "Menu,Vibe,Reserve", fr: "Menu,Ambiance,Réserver" },
                ctaLabel: { ar: "احجز طاولة", en: "Reserve a table", fr: "Réserver" },
                ctaHref: "#contact",
                sticky: "true",
              },
            },
            {
              id: "rs-hero",
              type: "hero",
              props: {
                ...defaultPropsFor("hero"),
                eyebrow: { ar: "مطبخ شامي معاصر · دمشق", en: "Contemporary Levantine · Damascus", fr: "Levantin contemporain · Damas" },
                headline: {
                  ar: "نكهات تُروى على نار هادئة",
                  en: "Flavors told over a quiet flame",
                  fr: "Des saveurs racontées à feu doux",
                },
                subheadline: {
                  ar: "مكونات موسمية، ضيافة دافئة، وأجواء تليق بأمسية لا تُنسى.",
                  en: "Seasonal ingredients, warm hospitality, and a room made for unforgettable evenings.",
                  fr: "Ingrédients de saison et hospitalité chaleureuse.",
                },
                ctaLabel: { ar: "احجز الآن", en: "Book now", fr: "Réserver" },
                secondaryLabel: { ar: "استعرض القائمة", en: "View menu", fr: "Voir le menu" },
                secondaryHref: "#menu",
                effectPreset: "float",
                entranceAnim: "float",
                paddingY: "104",
              },
            },
            {
              id: "rs-features",
              type: "features",
              props: {
                ...defaultPropsFor("features"),
                title: { ar: "لماذا نارنج", en: "Why Naranj", fr: "Pourquoi Naranj" },
                items: {
                  ar: "مكونات طازجة|نختار يومياً من السوق,شيف محلي|وصفات بروح شامية معاصرة,أجواء دافئة|إضاءة هادئة وطاولات مريحة",
                  en: "Fresh produce|Chosen daily from the market,Local chef|Levantine recipes with a modern soul,Warm room|Soft light and comfortable tables",
                  fr: "Produits frais|Marché du jour,Chef local|Recettes levantines,Ambiance|Lumière douce",
                },
                effectPreset: "lift-hover",
                hoverScale: "md",
                hoverShadow: "true",
                scrollReveal: "true",
              },
            },
            {
              id: "rs-pricing",
              type: "pricing",
              props: {
                ...defaultPropsFor("pricing"),
                title: { ar: "قوائم مقترحة", en: "Suggested menus", fr: "Menus suggérés" },
                effectPreset: "slide-up",
                entranceAnim: "slide-up",
                scrollReveal: "true",
              },
            },
            {
              id: "rs-gallery",
              type: "gallery",
              props: {
                ...defaultPropsFor("gallery"),
                title: { ar: "من المطبخ", en: "From the kitchen", fr: "Depuis la cuisine" },
                effectPreset: "scale-in",
                entranceAnim: "scale",
                scrollReveal: "true",
              },
            },
            {
              id: "rs-contact",
              type: "contact",
              props: {
                ...defaultPropsFor("contact"),
                title: { ar: "احجز طاولتك", en: "Reserve your table", fr: "Réservez" },
                email: "hello@naranj.example",
                phone: "+963 11 555 0101",
                address: { ar: "دمشق — أبو رمانة", en: "Damascus — Abu Rummaneh", fr: "Damas — Abu Rummaneh" },
              },
            },
            {
              id: "rs-footer",
              type: "footer",
              props: {
                ...defaultPropsFor("footer"),
                brand: { ar: "نارنج", en: "Naranj", fr: "Naranj" },
                text: { ar: "© 2026 نارنج — شهية طيبة", en: "© 2026 Naranj — bon appétit", fr: "© 2026 Naranj" },
              },
            },
          ],
        },
      ],
    },
  },
];

async function main() {
  for (const t of templates) {
    await prisma.template.upsert({
      where: { slug: t.slug },
      update: {
        name: t.name,
        nameAr: t.nameAr,
        description: t.description,
        descriptionAr: t.descriptionAr,
        category: t.category,
        content: t.content as object,
        thumbnail: `/templates/${t.slug}.svg`,
      },
      create: {
        slug: t.slug,
        name: t.name,
        nameAr: t.nameAr,
        description: t.description,
        descriptionAr: t.descriptionAr,
        category: t.category,
        content: t.content as object,
        thumbnail: `/templates/${t.slug}.svg`,
      },
    });
  }

  const passwordHash = await bcrypt.hash("demo1234", 10);
  const demo = await prisma.user.upsert({
    where: { email: "demo@siteforge.local" },
    update: { passwordHash, name: "Demo User" },
    create: {
      email: "demo@siteforge.local",
      name: "Demo User",
      passwordHash,
    },
  });

  const demoContent = templates.find((t) => t.slug === "portfolio")!.content;
  // Enrich demo content with form + collection list (non-destructive merge on seed)
  const enriched = structuredClone(demoContent) as typeof demoContent & { components?: unknown[] };
  if (!enriched.components) enriched.components = [];
  const home = enriched.pages[0];
  if (home && !home.blocks.some((b: { type: string }) => b.type === "form")) {
    home.blocks.splice(
      Math.max(0, home.blocks.length - 1),
      0,
      {
        id: "demo-collection",
        type: "collectionList" as const,
        props: {
          ...defaultPropsFor("collectionList"),
          collectionSlug: "projects",
          title: { ar: "المشاريع", en: "Projects" },
          subtitle: { ar: "من مجموعة CMS التجريبية", en: "From the demo CMS collection" },
        },
      },
      {
        id: "demo-form",
        type: "form" as const,
        props: defaultPropsFor("form"),
      }
    );
  }

  const demoSite = await prisma.site.upsert({
    where: { slug: "demo-studio" },
    update: {
      name: "Demo Studio",
      draftContent: enriched as object,
      publishedContent: enriched as object,
      publishedAt: new Date(),
      ownerId: demo.id,
    },
    create: {
      name: "Demo Studio",
      slug: "demo-studio",
      ownerId: demo.id,
      draftContent: enriched as object,
      publishedContent: enriched as object,
      publishedAt: new Date(),
    },
  });

  const projects = await prisma.collection.upsert({
    where: { siteId_slug: { siteId: demoSite.id, slug: "projects" } },
    update: {
      name: "مشاريع",
      fields: [
        { key: "title", label: "العنوان", type: "text" },
        { key: "summary", label: "الملخص", type: "richtext" },
        { key: "image", label: "صورة", type: "image" },
        { key: "url", label: "رابط", type: "url" },
      ],
    },
    create: {
      siteId: demoSite.id,
      name: "مشاريع",
      slug: "projects",
      fields: [
        { key: "title", label: "العنوان", type: "text" },
        { key: "summary", label: "الملخص", type: "richtext" },
        { key: "image", label: "صورة", type: "image" },
        { key: "url", label: "رابط", type: "url" },
      ],
    },
  });

  const existingItems = await prisma.collectionItem.count({ where: { collectionId: projects.id } });
  if (existingItems === 0) {
    const samples = [
      { title: "هوية بصرية", summary: "نظام هوية لمتجر محلي", url: "#", sort: 1 },
      { title: "موقع شركة", summary: "صفحة هبوط متعددة اللغات", url: "#", sort: 2 },
      { title: "حملة إطلاق", summary: "مواد إطلاق منتج رقمي", url: "#", sort: 3 },
    ];
    for (const s of samples) {
      await prisma.collectionItem.create({
        data: {
          collectionId: projects.id,
          published: true,
          sort: s.sort,
          data: { title: s.title, summary: s.summary, image: "", url: s.url },
        },
      });
    }
  }

  console.log("Seeded templates:", templates.map((t) => t.slug).join(", "));
  console.log("Demo CMS collection: projects");
  const adminHash = await bcrypt.hash("admin1234", 10);
  await prisma.user.upsert({ where: { email: "admin@siteforge.local" }, update: { passwordHash: adminHash, name: "Platform Admin", role: "ADMIN" }, create: { email: "admin@siteforge.local", name: "Platform Admin", passwordHash: adminHash, role: "ADMIN" } });
  console.log("Demo user: demo@siteforge.local / demo1234");
  console.log("Admin user: admin@siteforge.local / admin1234");
  console.log("Demo public site: /s/demo-studio");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
