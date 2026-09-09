"use client";

import { useState, type CSSProperties, type ReactNode, type MouseEvent } from "react";
import {
  assertSafeProxyUrl,
  buildRequest,
  parseClickBehavior,
  parseHttpAction,
  type ClickBehavior,
  type HttpAction,
} from "@/lib/http-action";
import { resolveBlockHref } from "@/lib/block-style";

async function runViaProxy(
  siteSlug: string,
  blockId: string,
  formData?: Record<string, unknown>
): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch(`/api/s/${encodeURIComponent(siteSlug)}/http`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blockId, data: formData || {} }),
  });
  const data = await res.json().catch(() => ({}));
  return {
    ok: Boolean(data.ok) || res.ok,
    message: typeof data.message === "string" ? data.message : undefined,
  };
}

async function runViaBrowser(action: HttpAction, formData?: Record<string, unknown>): Promise<{ ok: boolean; message?: string }> {
  const built = buildRequest(action, { formData, omitSecrets: true });
  const safe = assertSafeProxyUrl(built.url);
  if (!safe.ok) {
    return { ok: false, message: action.errorMessage || safe.error };
  }
  const res = await fetch(built.url, {
    method: built.method,
    headers: built.headers,
    body: built.body ?? undefined,
  });
  return {
    ok: res.ok,
    message: res.ok ? action.successMessage || undefined : action.errorMessage || `HTTP ${res.status}`,
  };
}

export async function executeBlockHttpAction(opts: {
  siteSlug: string;
  blockId: string;
  action: HttpAction;
  formData?: Record<string, unknown>;
}): Promise<{ ok: boolean; message?: string }> {
  if (!opts.action.enabled) return { ok: true };
  if (opts.action.runMode === "proxy") {
    return runViaProxy(opts.siteSlug, opts.blockId, opts.formData);
  }
  return runViaBrowser(opts.action, opts.formData);
}

function navigateHref(href: string, target?: string) {
  if (!href || href === "#") return;
  if (target === "_blank") {
    window.open(href, "_blank", "noopener,noreferrer");
  } else {
    window.location.assign(href);
  }
}

/**
 * Renders an <a> or <button> that may fire an HTTP action then optionally navigate.
 */
export function ActionableControl({
  siteSlug,
  blockId,
  props,
  hrefKey,
  className,
  style,
  children,
  as: Comp = "a",
}: {
  siteSlug?: string;
  blockId: string;
  props: Record<string, unknown>;
  hrefKey: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  as?: "a" | "button";
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const action = parseHttpAction(props.httpAction);
  const behavior: ClickBehavior = parseClickBehavior(props.clickBehavior);
  const link = resolveBlockHref(props, hrefKey, siteSlug);
  const useHttp = action.enabled && (behavior === "http" || behavior === "both");
  const useLink = behavior === "link" || behavior === "both" || !action.enabled;

  async function onClick(e: MouseEvent) {
    if (!useHttp) return; // let default <a> navigation happen
    e.preventDefault();
    if (busy || !siteSlug) return;
    setBusy(true);
    setMsg(null);
    try {
      const result = await executeBlockHttpAction({ siteSlug, blockId, action });
      if (!result.ok) {
        setMsg(result.message || action.errorMessage || "فشل الطلب");
        return;
      }
      if (result.message) setMsg(result.message);
      if (useLink && link.href && link.href !== "#") {
        navigateHref(link.href, link.target);
      }
    } catch {
      setMsg(action.errorMessage || "فشل الطلب");
    } finally {
      setBusy(false);
    }
  }

  const shared = {
    className: `${className || ""} ${busy ? "opacity-70 pointer-events-none" : ""}`.trim(),
    style,
    onClick: useHttp ? onClick : undefined,
    "aria-busy": busy || undefined,
  };

  const control =
    Comp === "button" || useHttp ? (
      <button type="button" {...shared}>
        {children}
      </button>
    ) : (
      <a href={link.href} target={link.target} rel={link.rel} {...shared}>
        {children}
      </a>
    );

  if (!msg) return control;
  return (
    <span className="inline-flex flex-col items-start gap-1">
      {control}
      <span className="text-[10px] opacity-80 max-w-[16rem] leading-4" role="status">
        {msg}
      </span>
    </span>
  );
}
