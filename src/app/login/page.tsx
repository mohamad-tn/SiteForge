"use client";

import Link from "next/link";
import { getSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthAtmosphere, GlassCard } from "@/components/ui/surface";
import { ThemeToggleButton } from "@/components/theme-provider";
import { PlatformLangSwitcher, usePlatformLang } from "@/components/platform-lang-provider";

export default function LoginPage() {
  const router = useRouter();
  const { lang, dir, t } = usePlatformLang();
  const [email, setEmail] = useState("demo@siteforge.local");
  const [password, setPassword] = useState("demo1234");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await signIn("credentials", { email, password, redirect: false });
    if (res?.error) {
      setLoading(false);
      setError(t("badCredentials"));
      return;
    }
    const session = await getSession();
    const dest = session?.user?.role === "ADMIN" ? "/admin" : "/dashboard";
    setLoading(false);
    router.push(dest);
    router.refresh();
  }

  return (
    <AuthAtmosphere className="px-4" dir={dir} lang={lang}>
      <div className="absolute top-4 end-4 flex items-center gap-2 sm:top-5 sm:end-5">
        <PlatformLangSwitcher size="compact" />
        <ThemeToggleButton />
      </div>
      <GlassCard className="w-full max-w-md p-7 sm:p-8">
        <div className="mb-6 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-800 text-xs font-bold text-white dark:bg-teal-500 dark:text-teal-950">
            SF
          </div>
          <div className="text-sm font-semibold tracking-tight text-teal-800 dark:text-teal-300">SiteForge</div>
        </div>
        <div className="mb-6">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{t("login")}</h1>
          <p className="mt-1.5 text-sm leading-6 text-[var(--muted)]">{t("welcomeBack")}</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="email">{t("email")}</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              dir="ltr"
              autoComplete="email"
              placeholder={t("placeholderEmail")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">{t("password")}</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              dir="ltr"
              autoComplete="current-password"
              placeholder={t("placeholderPassword")}
            />
          </div>
          {error ? <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p> : null}
          <Button type="submit" className="w-full rounded-full" disabled={loading}>
            {loading ? t("signingIn") : t("enter")}
          </Button>
        </form>
        <p className="mt-5 text-center text-sm text-[var(--muted)]">
          {t("noAccount")}{" "}
          <Link href="/signup" className="font-medium text-teal-800 hover:underline dark:text-teal-300">
            {t("createAccount")}
          </Link>
        </p>
        <p className="mt-2 text-center text-xs text-[var(--muted)]" dir="ltr">
          demo@siteforge.local / demo1234
        </p>
      </GlassCard>
    </AuthAtmosphere>
  );
}
