import { describe, expect, it } from "vitest";
import { isPlatformLang, platformDir, tPlatform, PLATFORM_LANG_KEY } from "@/lib/platform-i18n";
import { propLabel, styleLabel, motionLabel } from "@/lib/prop-labels";

describe("platform i18n", () => {
  it("validates langs and dirs", () => {
    expect(isPlatformLang("ar")).toBe(true);
    expect(isPlatformLang("fr")).toBe(false);
    expect(platformDir("ar")).toBe("rtl");
    expect(platformDir("en")).toBe("ltr");
    expect(PLATFORM_LANG_KEY).toBe("sf-platform-lang");
  });

  it("returns bilingual chrome copy", () => {
    expect(tPlatform("ar", "save")).toBe("حفظ");
    expect(tPlatform("en", "save")).toBe("Save");
    expect(tPlatform("en", "cmsHint")).toMatch(/CMS|collection/i);
    expect(tPlatform("ar", "canvasEmptyTitle")).toMatch(/فارغة|قسم/);
    expect(tPlatform("en", "canvasEmptyBody")).toMatch(/Insert|hero|refine/i);
    expect(tPlatform("en", "canvasEmptyCta")).toMatch(/Insert/i);
    expect(tPlatform("en", "staggerHelp")).toMatch(/nested|direct/i);
  });

  it("prop/style/motion labels stay in platform lang", () => {
    expect(propLabel("headline", "ar")).toContain("العنوان");
    expect(propLabel("headline", "en").toLowerCase()).toContain("headline");
    expect(styleLabel("bgColor", "en")).toBe("Background");
    expect(motionLabel("entranceAnim", "en")).toBe("Entrance");
  });

  it("chrome copy avoids jargon", () => {
    expect(tPlatform("ar", "inspector")).not.toMatch(/مفتش/);
    expect(tPlatform("ar", "mobileRight")).not.toMatch(/مفتش/);
    expect(tPlatform("en", "inspector").toLowerCase()).not.toMatch(/inspector/);
    expect(tPlatform("ar", "groupLook")).toBeTruthy();
    expect(tPlatform("ar", "preview")).toBeTruthy();
  });

  it("collections path copy is discoverable", () => {
    expect(tPlatform("ar", "cms")).toMatch(/مجموع/);
    expect(tPlatform("en", "cms").toLowerCase()).toMatch(/collection/);
    expect(tPlatform("ar", "openCms")).toMatch(/مجموع/);
    expect(tPlatform("en", "linkModeCollection").toLowerCase()).toMatch(/collection/);
    expect(tPlatform("ar", "cmsHowToUse")).toMatch(/قائمة مجموعة/);
    expect(tPlatform("en", "cmsEmptyNext")).toMatch(/Collection list/i);
    expect(tPlatform("ar", "cmsBindButtonHint")).toMatch(/زر/);
    expect(tPlatform("en", "cmsBindButtonHint").toLowerCase()).toMatch(/button/);
  });
});
