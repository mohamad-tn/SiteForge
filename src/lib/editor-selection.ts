/** Pure selection helpers for the visual editor (SRP — no React). */

export type SelectionState = {
  /** Primary id for the inspector / part focus. */
  selectedId: string | null;
  /** Multi-select membership (order = selection order). */
  selectedIds: string[];
};

export function clear(): string[] {
  return [];
}

export function add(ids: string[], id: string): string[] {
  if (ids.includes(id)) return ids;
  return [...ids, id];
}

export function toggleInSet(ids: string[], id: string): string[] {
  if (ids.includes(id)) return ids.filter((x) => x !== id);
  return [...ids, id];
}

export function selectAllIds(allIds: string[]): string[] {
  return [...allIds];
}

/** Prefer `preferred` when still in the set; else last selected; else null. */
export function primaryOf(ids: string[], preferred?: string | null): string | null {
  if (preferred && ids.includes(preferred)) return preferred;
  if (ids.length === 0) return null;
  return ids[ids.length - 1] ?? null;
}

export function replaceSelection(id: string | null): SelectionState {
  if (!id) return { selectedId: null, selectedIds: [] };
  return { selectedId: id, selectedIds: [id] };
}

export function toggleSelection(prev: SelectionState, id: string): SelectionState {
  const selectedIds = toggleInSet(prev.selectedIds, id);
  return {
    selectedIds,
    selectedId: primaryOf(selectedIds, id),
  };
}

export function selectAll(allIds: string[]): SelectionState {
  const selectedIds = selectAllIds(allIds);
  return {
    selectedIds,
    selectedId: primaryOf(selectedIds, selectedIds[0] ?? null),
  };
}

export function isLockedProp(props: Record<string, unknown> | undefined | null): boolean {
  if (!props) return false;
  return props.locked === "true" || props.locked === true;
}

export function isHiddenProp(props: Record<string, unknown> | undefined | null): boolean {
  if (!props) return false;
  return props.hidden === "true" || props.hidden === true;
}

/** Filter ids that are safe to delete / bulk-edit / duplicate (skip locked). */
export function unlockedIds(
  ids: string[],
  blocks: { id: string; props: Record<string, unknown> }[]
): string[] {
  const byId = new Map(blocks.map((b) => [b.id, b]));
  return ids.filter((id) => {
    const b = byId.get(id);
    return !!b && !isLockedProp(b.props);
  });
}
