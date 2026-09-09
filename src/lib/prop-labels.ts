/**
 * Inspector / CMS chrome labels — platform UI language only (ar|en).
 * Never mix with site content locales (AR/EN/FR/ES).
 */
import type { PlatformLang } from "@/lib/platform-i18n";
import type { StyleKey, MotionKey } from "@/lib/block-style";

type Bi = Record<PlatformLang, string>;

export const PROP_LABELS: Record<string, Bi> = {
  brand: { ar: "العلامة", en: "Brand" },
  links: { ar: "الروابط (مفصولة بفاصلة)", en: "Links (comma-separated)" },
  ctaLabel: { ar: "نص الزر", en: "CTA label" },
  ctaHref: { ar: "رابط الزر", en: "CTA URL" },
  sticky: { ar: "ثابت أعلى الصفحة", en: "Sticky top" },
  eyebrow: { ar: "نص صغير أعلى العنوان", en: "Small text above headline" },
  headline: { ar: "العنوان الرئيسي", en: "Main headline" },
  subheadline: { ar: "العنوان الفرعي", en: "Subheadline" },
  secondaryLabel: { ar: "زر ثانوي", en: "Secondary label" },
  secondaryHref: { ar: "رابط ثانوي", en: "Secondary URL" },
  align: { ar: "المحاذاة", en: "Align" },
  showBadge: { ar: "إظهار الشارة", en: "Show badge" },
  title: { ar: "العنوان", en: "Title" },
  subtitle: { ar: "وصف فرعي", en: "Subtitle" },
  items: { ar: "العناصر", en: "Items" },
  columns: { ar: "الأعمدة / أعمدة التذييل", en: "Columns / footer columns" },
  body: { ar: "النص", en: "Body" },
  buttonLabel: { ar: "نص الزر", en: "Button label" },
  buttonHref: { ar: "رابط الزر", en: "Button URL" },
  email: { ar: "البريد", en: "Email" },
  phone: { ar: "الهاتف", en: "Phone" },
  address: { ar: "العنوان", en: "Address" },
  text: { ar: "النص", en: "Text" },
  level: { ar: "مستوى العنوان", en: "Heading level" },
  src: { ar: "الوسائط", en: "Media" },
  poster: { ar: "صورة الغلاف", en: "Poster" },
  alt: { ar: "النص البديل", en: "Alt text" },
  caption: { ar: "التعليق", en: "Caption" },
  aspect: { ar: "نسبة الأبعاد", en: "Aspect ratio" },
  rounded: { ar: "زوايا دائرية", en: "Rounded" },
  label: { ar: "التسمية", en: "Label" },
  href: { ar: "الرابط", en: "URL" },
  variant: { ar: "النمط", en: "Variant" },
  size: { ar: "الحجم", en: "Size" },
  height: { ar: "الارتفاع (محتوى)", en: "Height (content)" },
  leftTitle: { ar: "عنوان العمود 1", en: "Column 1 title" },
  leftBody: { ar: "نص العمود 1", en: "Column 1 body" },
  rightTitle: { ar: "عنوان العمود 2", en: "Column 2 title" },
  rightBody: { ar: "نص العمود 2", en: "Column 2 body" },
  ratio: { ar: "نسبة الأعمدة", en: "Column ratio" },
  style: { ar: "النمط", en: "Style" },
  autoplay: { ar: "تشغيل تلقائي", en: "Autoplay" },
  loop: { ar: "تكرار", en: "Loop" },
  muted: { ar: "كتم الصوت", en: "Muted" },
  controls: { ar: "أزرار التحكم", en: "Controls" },
  fieldsConfig: { ar: "حقول النموذج (مفصولة بفاصلة)", en: "Form fields (comma-separated)" },
  submitLabel: { ar: "نص زر الإرسال", en: "Submit label" },
  successMessage: { ar: "رسالة النجاح", en: "Success message" },
  collectionSlug: { ar: "معرّف المجموعة (slug)", en: "Collection slug" },
  limit: { ar: "عدد العناصر", en: "Item limit" },
  cardTitleField: { ar: "حقل العنوان", en: "Title field" },
  cardBodyField: { ar: "حقل الوصف", en: "Body field" },
  cardImageField: { ar: "حقل الصورة", en: "Image field" },
  cardUrlField: { ar: "حقل الرابط", en: "URL field" },
};

export const STYLE_LABELS_I18N: Record<StyleKey | "linkMode" | "linkPageSlug" | "openInNewTab", Bi> = {
  width: { ar: "العرض", en: "Width" },
  height: { ar: "الارتفاع", en: "Height" },
  minWidth: { ar: "أدنى عرض", en: "Min width" },
  maxWidth: { ar: "أقصى عرض", en: "Max width" },
  minHeight: { ar: "أدنى ارتفاع", en: "Min height" },
  maxHeight: { ar: "أقصى ارتفاع", en: "Max height" },
  paddingY: { ar: "حشو عمودي", en: "Padding Y" },
  paddingX: { ar: "حشو أفقي", en: "Padding X" },
  paddingTop: { ar: "حشو أعلى", en: "Padding top" },
  paddingRight: { ar: "حشو يمين", en: "Padding right" },
  paddingBottom: { ar: "حشو أسفل", en: "Padding bottom" },
  paddingLeft: { ar: "حشو يسار", en: "Padding left" },
  marginY: { ar: "هامش عمودي", en: "Margin Y" },
  marginX: { ar: "هامش أفقي", en: "Margin X" },
  marginTop: { ar: "هامش أعلى", en: "Margin top" },
  marginRight: { ar: "هامش يمين", en: "Margin right" },
  marginBottom: { ar: "هامش أسفل", en: "Margin bottom" },
  marginLeft: { ar: "هامش يسار", en: "Margin left" },
  bgColor: { ar: "لون الخلفية", en: "Background" },
  textColor: { ar: "لون النص", en: "Text color" },
  fontSize: { ar: "حجم الخط", en: "Font size" },
  fontWeight: { ar: "وزن الخط", en: "Font weight" },
  letterSpacing: { ar: "تباعد الحروف", en: "Letter spacing" },
  lineHeight: { ar: "ارتفاع السطر", en: "Line height" },
  textAlign: { ar: "محاذاة النص", en: "Text align" },
  borderRadius: { ar: "استدارة", en: "Radius" },
  radiusTL: { ar: "زاوية أعلى-يسار", en: "Radius TL" },
  radiusTR: { ar: "زاوية أعلى-يمين", en: "Radius TR" },
  radiusBR: { ar: "زاوية أسفل-يمين", en: "Radius BR" },
  radiusBL: { ar: "زاوية أسفل-يسار", en: "Radius BL" },
  borderWidth: { ar: "سمك الإطار", en: "Border width" },
  borderStyle: { ar: "نمط الإطار", en: "Border style" },
  borderColor: { ar: "لون الإطار", en: "Border color" },
  boxShadow: { ar: "ظل جاهز", en: "Shadow preset" },
  customShadow: { ar: "ظل مخصص (CSS)", en: "Custom shadow" },
  opacity: { ar: "الشفافية", en: "Opacity" },
  overflow: { ar: "الفيض", en: "Overflow" },
  display: { ar: "طريقة العرض", en: "Display mode" },
  gap: { ar: "الفجوة", en: "Gap" },
  zIndex: { ar: "ترتيب الطبقة", en: "Stack order" },
  customCss: { ar: "تنسيق متقدم لهذا العنصر", en: "Advanced styling for this item" },
  hidden: { ar: "إخفاء", en: "Hidden" },
  linkMode: { ar: "نوع الرابط", en: "Link type" },
  linkPageSlug: { ar: "صفحة داخلية", en: "Internal page" },
  openInNewTab: { ar: "فتح في تبويب جديد", en: "Open in new tab" },
};

export const MOTION_LABELS_I18N: Record<MotionKey, Bi> = {
  effectPreset: { ar: "التأثير", en: "Effect" },
  entranceAnim: { ar: "حركة الدخول", en: "Entrance" },
  animDuration: { ar: "المدة (مللي ثانية)", en: "Duration (ms)" },
  animDelay: { ar: "التأخير (مللي ثانية)", en: "Delay (ms)" },
  hoverScale: { ar: "تكبير عند التمرير", en: "Hover scale" },
  hoverShadow: { ar: "ظل عند التمرير", en: "Hover shadow" },
  scrollReveal: { ar: "ظهور عند التمرير للأسفل", en: "Reveal on scroll" },
};

export const EFFECT_PRESET_LABELS: Record<string, Bi> = {
  none: { ar: "بدون", en: "None" },
  "soft-fade": { ar: "تلاشي ناعم", en: "Soft fade" },
  "slide-up": { ar: "انزلاق لأعلى", en: "Slide up" },
  "scale-in": { ar: "تكبير تدريجي", en: "Scale in" },
  float: { ar: "طفو خفيف", en: "Float" },
  "glow-hover": { ar: "توهج عند التمرير", en: "Glow on hover" },
  "lift-hover": { ar: "رفع عند التمرير", en: "Lift on hover" },
  "blur-in": { ar: "ظهور من ضباب", en: "Blur in" },
};

export function effectPresetLabel(id: string, lang: PlatformLang): string {
  const row = EFFECT_PRESET_LABELS[id];
  return row?.[lang] || row?.en || id;
}

export function propLabel(key: string, lang: PlatformLang): string {
  return PROP_LABELS[key]?.[lang] || PROP_LABELS[key]?.en || key;
}

export function styleLabel(key: string, lang: PlatformLang): string {
  const row = STYLE_LABELS_I18N[key as keyof typeof STYLE_LABELS_I18N];
  return row?.[lang] || row?.en || key;
}

export function motionLabel(key: string, lang: PlatformLang): string {
  const row = MOTION_LABELS_I18N[key as MotionKey];
  return row?.[lang] || row?.en || key;
}
