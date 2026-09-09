/** Editor chrome preferences (localStorage). Pure helpers for vitest. */

export const LEFT_COLLAPSED_KEY = "sf-editor-left-collapsed";
export const RIGHT_COLLAPSED_KEY = "sf-editor-right-collapsed";

export function parseCollapsedFlag(raw: string | null | undefined): boolean {
  return raw === "1" || raw === "true";
}

export function serializeCollapsedFlag(collapsed: boolean): string {
  return collapsed ? "1" : "0";
}

export function readCollapsedPref(key: string, fallback = false): boolean {
  if (typeof window === "undefined") return fallback;
  try {
    return parseCollapsedFlag(localStorage.getItem(key));
  } catch {
    return fallback;
  }
}

export function writeCollapsedPref(key: string, collapsed: boolean) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, serializeCollapsedFlag(collapsed));
  } catch {
    /* ignore quota */
  }
}
