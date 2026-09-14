import { describe, expect, it } from "vitest";
import { paginateSlice, ADMIN_PAGE_SIZE } from "@/lib/admin-format";

describe("DataTable pagination helpers", () => {
  it("default page size is 20", () => {
    expect(ADMIN_PAGE_SIZE).toBe(20);
  });

  it("clamps page into range", () => {
    const items = [1, 2, 3];
    const over = paginateSlice(items, 99, 2);
    expect(over.page).toBe(2);
    expect(over.rows).toEqual([3]);
  });
});
