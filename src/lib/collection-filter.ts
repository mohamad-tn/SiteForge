/** Client-side collection card filter (title/body). */
export function filterCollectionItems<T extends { data?: Record<string, unknown> }>(
  items: T[],
  query: string,
  titleField: string,
  bodyField?: string
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((it) => {
    const data = it.data || {};
    const title = typeof data[titleField] === "string" ? (data[titleField] as string).toLowerCase() : "";
    const body =
      bodyField && typeof data[bodyField] === "string" ? (data[bodyField] as string).toLowerCase() : "";
    return title.includes(q) || body.includes(q);
  });
}

export function matchCollectionItemId(
  item: { id: string; data?: Record<string, unknown> },
  focusItem: string,
  titleField: string
): boolean {
  if (!focusItem) return false;
  const title = typeof item.data?.[titleField] === "string" ? (item.data[titleField] as string) : "";
  const slugish = title.toLowerCase().replace(/\s+/g, "-");
  return item.id === focusItem || slugish === focusItem.toLowerCase();
}
