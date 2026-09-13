import { describe, expect, it } from "vitest";
import { isExternalHttpHref, normalizeHref, shouldOpenInNewTab } from "@/lib/href";

describe("normalizeHref", () => {
  it("trims and maps empty to hash", () => {
    expect(normalizeHref("")).toBe("#");
    expect(normalizeHref("   ")).toBe("#");
    expect(normalizeHref(null)).toBe("#");
    expect(normalizeHref(undefined)).toBe("#");
  });

  it("keeps hash, query, and absolute paths", () => {
    expect(normalizeHref("#cta")).toBe("#cta");
    expect(normalizeHref("?p=home")).toBe("?p=home");
    expect(normalizeHref("/about")).toBe("/about");
    expect(normalizeHref("/s/demo?p=work#x")).toBe("/s/demo?p=work#x");
  });

  it("keeps mailto and tel", () => {
    expect(normalizeHref("mailto:hi@example.com")).toBe("mailto:hi@example.com");
    expect(normalizeHref("tel:+963911")).toBe("tel:+963911");
  });

  it("keeps absolute http(s)", () => {
    expect(normalizeHref("https://google.com")).toBe("https://google.com");
    expect(normalizeHref("http://example.com/a")).toBe("http://example.com/a");
  });

  it("upgrades bare hosts and www to https", () => {
    expect(normalizeHref("www.google.com")).toBe("https://www.google.com");
    expect(normalizeHref("google.com")).toBe("https://google.com");
    expect(normalizeHref("google.com/search?q=1")).toBe("https://google.com/search?q=1");
    expect(normalizeHref("sub.domain.co.uk/path")).toBe("https://sub.domain.co.uk/path");
  });

  it("upgrades protocol-relative to https", () => {
    expect(normalizeHref("//cdn.example.com/x.js")).toBe("https://cdn.example.com/x.js");
  });

  it("does not treat single-word slugs as domains", () => {
    expect(normalizeHref("about")).toBe("about");
    expect(normalizeHref("home")).toBe("home");
    expect(normalizeHref("cta")).toBe("cta");
  });

  it("blocks dangerous schemes", () => {
    expect(normalizeHref("javascript:alert(1)")).toBe("#");
    expect(normalizeHref("JavaScript:alert(1)")).toBe("#");
    expect(normalizeHref("data:text/html,<h1>x</h1>")).toBe("#");
    expect(normalizeHref("vbscript:msgbox(1)")).toBe("#");
    expect(normalizeHref("blob:https://x")).toBe("#");
    expect(normalizeHref("file:///etc/passwd")).toBe("#");
  });

  it("blocks unknown schemes", () => {
    expect(normalizeHref("ftp://files.example.com")).toBe("#");
    expect(normalizeHref("ssh://host")).toBe("#");
  });
});

describe("isExternalHttpHref", () => {
  it("detects http(s) only", () => {
    expect(isExternalHttpHref("https://a.com")).toBe(true);
    expect(isExternalHttpHref("http://a.com")).toBe(true);
    expect(isExternalHttpHref("/about")).toBe(false);
    expect(isExternalHttpHref("#x")).toBe(false);
    expect(isExternalHttpHref("mailto:a@b.c")).toBe(false);
  });
});

describe("shouldOpenInNewTab", () => {
  it("honors explicit true/false", () => {
    expect(shouldOpenInNewTab("true", "https://a.com")).toBe(true);
    expect(shouldOpenInNewTab("false", "https://a.com")).toBe(false);
    expect(shouldOpenInNewTab("true", "/about")).toBe(true);
    expect(shouldOpenInNewTab("false", "/about")).toBe(false);
  });

  it("defaults external unset to new tab", () => {
    expect(shouldOpenInNewTab("", "https://a.com")).toBe(true);
    expect(shouldOpenInNewTab(undefined, "https://www.google.com")).toBe(true);
    expect(shouldOpenInNewTab("", "/about")).toBe(false);
    expect(shouldOpenInNewTab(undefined, "#cta")).toBe(false);
  });
});
