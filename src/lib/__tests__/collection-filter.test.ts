import { describe, expect, it } from "vitest";
import { filterCollectionItems, matchCollectionItemId } from "@/lib/collection-filter";

describe("collection filter", () => {
  const items = [
    { id: "a", data: { title: "Alpha Studio", summary: "design" } },
    { id: "b", data: { title: "Beta Shop", summary: "retail" } },
  ];

  it("filters by title", () => {
    expect(filterCollectionItems(items, "alpha", "title", "summary")).toHaveLength(1);
    expect(filterCollectionItems(items, "retail", "title", "summary")[0].id).toBe("b");
  });

  it("matches item id or title slug", () => {
    expect(matchCollectionItemId(items[0], "a", "title")).toBe(true);
    expect(matchCollectionItemId(items[0], "alpha-studio", "title")).toBe(true);
    expect(matchCollectionItemId(items[0], "nope", "title")).toBe(false);
  });
});
