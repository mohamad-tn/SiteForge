"use client";

import Link from "next/link";
import { getSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PasswordChecklist,
  PasswordInput,
  passwordRulesPass,
} from "@/components/auth/password-field";
import { AuthAtmosphere, GlassCard } from "@/components/ui/surface";
import { ThemeToggleButton } from "@/components/theme-provider";
import { PlatformLangSwitcher, usePlatformLang } from "@/components/platform-lang-provider";

export default function SignupPage() {
  const router = useRouter();
  const { lang, dir, t } = usePlatformLang();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordRulesPass(password)) {
      setError(t("changePasswordTooShort"));
      return;
    }
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      setLoading(false);
      setError(data.error || t("signupFailed"));
      return;
    }
    const login = await signIn("credentials", { email, password, redirect: false });
    if (login?.error) {
      setLoading(false);
      setError(t("signupLoginFailed"));
      return;
    }
    const session = await getSession();
    const dest = session?.user?.role === "ADMIN" ? "/admin" : "/dashboard";
    setLoading(false);
    router.push(dest);
    router.refresh();
  }

  return (
    <AuthAtmosphere dir={dir} lang={lang}>
      <div className="sf-auth-controls">
        <PlatformLangSwitcher size="compact" />
        <ThemeToggleButton />
      </div>
      <div className="sf-auth-layout">
        <aside className="sf-auth-brand">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-800 text-xs font-bold text-white dark:bg-teal-500 dark:text-teal-950">
              SF
            </div>
            <div className="text-sm font-semibold tracking-tight text-teal-800 dark:text-teal-300">SiteForge</div>
          </div>
          <p className="sf-auth-brand-quote">{t("authBrandQuote")}</p>
          <p className="sf-auth-brand-meta">{t("authBrandMeta")}</p>
        </aside>
        <div className="sf-auth-card-wrap">
          <GlassCard className="w-full max-w-md p-7 sm:p-8">
            <div className="mb-6 flex items-center gap-2.5 lg:hidden">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-800 text-xs font-bold text-white dark:bg-teal-500 dark:text-teal-950">
                SF
              </div>
              <div className="text-sm font-semibold tracking-tight text-teal-800 dark:text-teal-300">SiteForge</div>
            </div>
            <div className="mb-6">
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{t("signup")}</h1>
              <p className="mt-1.5 text-sm text-[var(--muted)]">{t("signupSub")}</p>
            </div>
            <form onSubmit={onSubmit} className="space-y-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="name">{t("name")}</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                  placeholder={t("placeholderName")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">{t("email")}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder={t("placeholderEmail")}
                />
              </div>
              <PasswordInput
                id="password"
                label={t("password")}
                value={password}
                onChange={setPassword}
                required
                autoComplete="new-password"
                placeholder={t("placeholderPassword")}
              />
              <PasswordChecklist password={password} lang={lang === "en" ? "en" : "ar"} />
              {error ? <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p> : null}
              <Button
                type="submit"
                className="w-full rounded-full"
                disabled={loading || !passwordRulesPass(password)}
              >
                {loading ? t("creatingAccount") : t("createAccountBtn")}
              </Button>
            </form>
            <p className="mt-5 text-center text-sm text-[var(--muted)]">
              {t("haveAccount")}{" "}
              <Link href="/login" className="font-medium text-teal-800 hover:underline dark:text-teal-300">
                {t("login")}
              </Link>
            </p>
          </GlassCard>
        </div>
      </div>
    </AuthAtmosphere>
  );
}
