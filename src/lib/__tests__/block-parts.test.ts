import { describe, expect, it } from "vitest";
import { ensureNavItems, syncLinksCsvFromNavItems } from "@/lib/design";
import {
  ensureFeatureItems,
  syncFeatureItemsCsv,
  ensurePricingPlans,
  syncPricingPlansCsv,
  ensureTestimonials,
  syncTestimonialsCsv,
  ensureFaqItems,
  syncFaqCsv,
  ensureFormFields,
  syncFormFieldsConfig,
  listBlockParts,
  getPartStyles,
  setPartStyles,
} from "@/lib/block-parts";

describe("navItems migration", () => {
  it("migrates localized CSV links into navItems", () => {
    const items = ensureNavItems(
      {
        links: { ar: "الرئيسية,تواصل", en: "Home,Contact" },
      },
      ["ar", "en"]
    );
    expect(items.length).toBe(2);
    expect(typeof items[0].id).toBe("string");
    const csv = syncLinksCsvFromNavItems(items, ["ar", "en"]);
    expect(csv.ar).toContain("الرئيسية");
    expect(csv.en).toContain("Home");
  });

  it("keeps existing navItems", () => {
    const items = ensureNavItems({
      navItems: [{ id: "a", label: { en: "A" }, href: "/a" }],
    });
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("a");
  });
});

describe("featureItems migration", () => {
  it("migrates pipe CSV", () => {
    const items = ensureFeatureItems({ items: "Speed|Fast,Flex|Open" }, ["en"]);
    expect(items).toHaveLength(2);
    expect(items[0].id).toBe("feat-0");
    expect(syncFeatureItemsCsv(items, ["en"]).en).toContain("Speed|Fast");
  });
});

describe("pricingPlans migration", () => {
  it("migrates pipe pricing CSV with stable ids", () => {
    const plans = ensurePricingPlans(
      { items: "Starter|Free|1 page|Basic,Pro|$29|Unlimited|Popular" },
      ["en"]
    );
    expect(plans).toHaveLength(2);
    expect(plans[0].id).toBe("plan-0");
    expect(plans[1].highlighted).toBe(true);
    const csv = syncPricingPlansCsv(plans, ["en"]);
    expect(csv.en).toContain("Starter|Free");
    expect(csv.en).toContain("Pro|$29");
  });

  it("keeps structured pricingPlans", () => {
    const plans = ensurePricingPlans({
      pricingPlans: [
        {
          id: "p1",
          name: "A",
          price: "$1",
          features: "x|y",
          ctaLabel: "Go",
          highlighted: false,
        },
      ],
    });
    expect(plans[0].id).toBe("p1");
  });
});

describe("testimonials migration", () => {
  it("migrates name|role|quote CSV", () => {
    const items = ensureTestimonials(
      { items: "Sara|CEO|Great product,Ali|Dev|Love it" },
      ["en"]
    );
    expect(items).toHaveLength(2);
    expect(items[0].id).toBe("tst-0");
    expect(syncTestimonialsCsv(items, ["en"]).en).toContain("Sara|CEO|Great product");
  });
});

describe("faq migration", () => {
  it("migrates q|a CSV", () => {
    const items = ensureFaqItems({ items: "What?|This.,How?|Easily." }, ["en"]);
    expect(items).toHaveLength(2);
    expect(items[0].id).toBe("faq-0");
    expect(syncFaqCsv(items, ["en"]).en).toContain("What?|This.");
  });
});

describe("form fields", () => {
  it("parses fieldsConfig into stable field parts", () => {
    const fields = ensureFormFields({ fieldsConfig: "name,email,message" });
    expect(fields.map((f) => f.id)).toEqual(["fld-name", "fld-email", "fld-message"]);
    expect(syncFormFieldsConfig(fields)).toBe("name,email,message");
  });
});

describe("partStyles map", () => {
  it("sets and clears textColor/fontSize", () => {
    let props: Record<string, unknown> = {};
    props = setPartStyles(props, "headline", { textColor: "#f00", fontSize: "42" });
    expect(getPartStyles(props, "headline")).toEqual({ textColor: "#f00", fontSize: "42" });
    props = setPartStyles(props, "headline", { textColor: "", fontSize: "" });
    expect(getPartStyles(props, "headline")).toEqual({});
  });
});

describe("listBlockParts", () => {
  it("lists navbar children", () => {
    const parts = listBlockParts(
      {
        id: "n1",
        type: "navbar",
        props: {
          brand: "Brand",
          navItems: [{ id: "l1", label: "Home", href: "#" }],
          ctaLabel: "Go",
        },
      },
      "en"
    );
    expect(parts.some((p) => p.part === "brand")).toBe(true);
    expect(parts.some((p) => p.part === "link:l1")).toBe(true);
    expect(parts.some((p) => p.part === "cta")).toBe(true);
  });

  it("lists pricing plan items", () => {
    const parts = listBlockParts(
      {
        id: "pr1",
        type: "pricing",
        props: {
          title: "Pricing",
          pricingPlans: [
            {
              id: "plan-a",
              name: "Basic",
              price: "0",
              features: "a",
              ctaLabel: "Go",
              highlighted: false,
            },
          ],
        },
      },
      "en"
    );
    expect(parts.some((p) => p.part === "title")).toBe(true);
    expect(parts.some((p) => p.part === "item:plan-a")).toBe(true);
  });

  it("lists contact scalar parts", () => {
    const parts = listBlockParts(
      {
        id: "c1",
        type: "contact",
        props: { title: "Hi", email: "a@b.c", phone: "1", address: "X", buttonLabel: "Send" },
      },
      "en"
    );
    expect(parts.map((p) => p.part)).toEqual(
      expect.arrayContaining(["title", "email", "phone", "address", "button"])
    );
  });

  it("lists form field parts", () => {
    const parts = listBlockParts(
      {
        id: "f1",
        type: "form",
        props: { title: "Form", fieldsConfig: "name,email" },
      },
      "en"
    );
    expect(parts.some((p) => p.part === "field:fld-name")).toBe(true);
    expect(parts.some((p) => p.part === "submit")).toBe(true);
  });

  it("lists collectionList binding parts", () => {
    const parts = listBlockParts(
      {
        id: "cl1",
        type: "collectionList",
        props: { title: "Projects", collectionSlug: "projects", columns: "3" },
      },
      "en"
    );
    expect(parts.some((p) => p.part === "collectionSlug")).toBe(true);
    expect(parts.some((p) => p.part === "cardTitleField")).toBe(true);
  });
});
