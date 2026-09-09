/**
 * Server-side site secrets vault.
 * Values are AES-256-GCM encrypted at rest and never returned by owner list/create APIs.
 * Published httpAction JSON should store only placeholders: secret:NAME or {{secret:NAME}}.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import type { HttpAction, KvRow } from "@/lib/http-action";

export const SECRET_NAME_RE = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
export const SECRET_PREFIX_RE = /^secret:([A-Za-z][A-Za-z0-9_-]{0,63})$/;
export const SECRET_TEMPLATE_RE = /\{\{secret:([A-Za-z][A-Za-z0-9_-]{0,63})\}\}/g;

function vaultKey(): Buffer {
  const raw =
    process.env.SECRETS_VAULT_KEY?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    "siteforge-insecure-dev-vault-key";
  return createHash("sha256").update(raw).digest();
}

/** Encrypt plaintext for SiteSecret.valueEnc (`v1:iv:tag:ciphertext` base64url). */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", vaultKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${enc.toString("base64url")}`;
}

export function decryptSecret(payload: string): string {
  const parts = String(payload || "").split(":");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Invalid vault payload");
  }
  const iv = Buffer.from(parts[1], "base64url");
  const tag = Buffer.from(parts[2], "base64url");
  const data = Buffer.from(parts[3], "base64url");
  const decipher = createDecipheriv("aes-256-gcm", vaultKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function isValidSecretName(name: string): boolean {
  return SECRET_NAME_RE.test(name);
}

/** True if value is a vault ref (prefix or template) — safe to store in published JSON. */
export function referencesSiteSecret(value: string): boolean {
  const v = String(value || "");
  if (SECRET_PREFIX_RE.test(v.trim())) return true;
  SECRET_TEMPLATE_RE.lastIndex = 0;
  return SECRET_TEMPLATE_RE.test(v);
}

export function collectSecretNamesFromString(text: string, into: Set<string> = new Set()): Set<string> {
  const v = String(text || "");
  const prefix = SECRET_PREFIX_RE.exec(v.trim());
  if (prefix) into.add(prefix[1]);
  SECRET_TEMPLATE_RE.lastIndex = 0;
  for (const m of v.matchAll(SECRET_TEMPLATE_RE)) {
    into.add(m[1]);
  }
  return into;
}

function scanRows(rows: KvRow[], into: Set<string>) {
  for (const row of rows) collectSecretNamesFromString(row.value, into);
}

export function collectSecretNamesFromAction(action: HttpAction): string[] {
  const names = new Set<string>();
  scanRows(action.headers, names);
  scanRows(action.query, names);
  scanRows(action.pathParams, names);
  scanRows(action.formFields, names);
  collectSecretNamesFromString(action.url, names);
  collectSecretNamesFromString(action.bodyJson, names);
  collectSecretNamesFromString(action.bodyRaw, names);
  return [...names];
}

export type ResolveResult =
  | { ok: true; value: string }
  | { ok: false; missing: string };

/**
 * Resolve `secret:NAME` (whole value) or `{{secret:NAME}}` interpolations.
 * Unknown names → { ok:false, missing }.
 */
export function resolveSecretRefs(text: string, secrets: Record<string, string>): ResolveResult {
  const raw = String(text ?? "");
  const prefix = SECRET_PREFIX_RE.exec(raw.trim());
  if (prefix) {
    const name = prefix[1];
    if (!(name in secrets)) return { ok: false, missing: name };
    return { ok: true, value: secrets[name] };
  }

  let missing: string | null = null;
  SECRET_TEMPLATE_RE.lastIndex = 0;
  const value = raw.replace(SECRET_TEMPLATE_RE, (_m, name: string) => {
    if (!(name in secrets)) {
      missing = name;
      return "";
    }
    return secrets[name];
  });
  if (missing) return { ok: false, missing };
  return { ok: true, value };
}

function mapRows(rows: KvRow[], secrets: Record<string, string>): ResolveResult & { rows?: KvRow[] } {
  const next: KvRow[] = [];
  for (const row of rows) {
    const wasRef = referencesSiteSecret(row.value);
    const r = resolveSecretRefs(row.value, secrets);
    if (!r.ok) return r;
    next.push({ ...row, value: r.value, secret: row.secret || wasRef });
  }
  return { ok: true, value: "", rows: next };
}

/**
 * Return a copy of HttpAction with all vault placeholders replaced.
 * Does not mutate the published config.
 */
export function applySiteSecretsToAction(
  action: HttpAction,
  secrets: Record<string, string>
): { ok: true; action: HttpAction } | { ok: false; missing: string } {
  const headers = mapRows(action.headers, secrets);
  if (!headers.ok) return headers;
  const query = mapRows(action.query, secrets);
  if (!query.ok) return query;
  const pathParams = mapRows(action.pathParams, secrets);
  if (!pathParams.ok) return pathParams;
  const formFields = mapRows(action.formFields, secrets);
  if (!formFields.ok) return formFields;

  const url = resolveSecretRefs(action.url, secrets);
  if (!url.ok) return url;
  const bodyJson = resolveSecretRefs(action.bodyJson, secrets);
  if (!bodyJson.ok) return bodyJson;
  const bodyRaw = resolveSecretRefs(action.bodyRaw, secrets);
  if (!bodyRaw.ok) return bodyRaw;

  return {
    ok: true,
    action: {
      ...action,
      url: url.value,
      bodyJson: bodyJson.value,
      bodyRaw: bodyRaw.value,
      headers: headers.rows!,
      query: query.rows!,
      pathParams: pathParams.rows!,
      formFields: formFields.rows!,
    },
  };
}

/** Load + decrypt all secrets for a site (proxy / server only). */
export async function loadSiteSecretMap(siteId: string): Promise<Record<string, string>> {
  const rows = await prisma.siteSecret.findMany({
    where: { siteId },
    select: { name: true, valueEnc: true },
  });
  const map: Record<string, string> = {};
  for (const row of rows) {
    try {
      map[row.name] = decryptSecret(row.valueEnc);
    } catch {
      // skip corrupt rows; resolution will report missing if referenced
    }
  }
  return map;
}

/** Public metadata shape — never includes value / valueEnc. */
export type SiteSecretMeta = {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
};

export function toSecretMeta(row: {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}): SiteSecretMeta {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
