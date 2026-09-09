"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SiteContent } from "@/lib/design";

const MAX = 30;
const DEBOUNCE_MS = 280;

export function useEditorHistory(initial: SiteContent) {
  const [content, setContentState] = useState<SiteContent>(initial);
  const past = useRef<SiteContent[]>([]);
  const future = useRef<SiteContent[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const pendingBase = useRef<SiteContent | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(initial);

  const syncFlags = useCallback(() => {
    setCanUndo(past.current.length > 0);
    setCanRedo(future.current.length > 0);
  }, []);

  const flushDebounce = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
    if (pendingBase.current) {
      past.current = [...past.current.slice(-(MAX - 1)), pendingBase.current];
      pendingBase.current = null;
      future.current = [];
      syncFlags();
    }
  }, [syncFlags]);

  useEffect(() => () => flushDebounce(), [flushDebounce]);

  const commit = useCallback(
    (next: SiteContent | ((prev: SiteContent) => SiteContent)) => {
      setContentState((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;
        if (resolved === prev) return prev;
        if (!pendingBase.current) pendingBase.current = structuredClone(prev);
        latest.current = resolved;
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => {
          if (pendingBase.current) {
            past.current = [...past.current.slice(-(MAX - 1)), pendingBase.current];
            pendingBase.current = null;
            future.current = [];
            syncFlags();
          }
        }, DEBOUNCE_MS);
        return resolved;
      });
    },
    [syncFlags]
  );

  const replace = useCallback(
    (next: SiteContent) => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      pendingBase.current = null;
      past.current = [];
      future.current = [];
      latest.current = next;
      setContentState(next);
      syncFlags();
    },
    [syncFlags]
  );

  const undo = useCallback(() => {
    flushDebounce();
    setContentState((prev) => {
      const last = past.current.pop();
      if (!last) return prev;
      future.current = [...future.current, structuredClone(prev)];
      latest.current = last;
      queueMicrotask(syncFlags);
      return last;
    });
  }, [flushDebounce, syncFlags]);

  const redo = useCallback(() => {
    flushDebounce();
    setContentState((prev) => {
      const next = future.current.pop();
      if (!next) return prev;
      past.current = [...past.current, structuredClone(prev)];
      latest.current = next;
      queueMicrotask(syncFlags);
      return next;
    });
  }, [flushDebounce, syncFlags]);

  return { content, commit, replace, undo, redo, canUndo, canRedo };
}
