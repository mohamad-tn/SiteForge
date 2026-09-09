"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SoftCard, AppCanvas } from "@/components/ui/surface";
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
    setLoading(false);
    if (res?.error) {
      setError(t("badCredentials"));
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <AppCanvas className="flex items-center justify-center px-4" dir={dir} lang={lang}>
      <div className="absolute top-5 end-5 flex items-center gap-2">
        <PlatformLangSwitcher size="compact" />
        <ThemeToggleButton />
      </div>
      <SoftCard className="w-full max-w-md p-8 shadow-[0_24px_60px_-36px_rgba(28,25,23,0.45)]">
        <div className="mb-7">
          <div className="text-sm font-semibold tracking-tight text-teal-800 dark:text-teal-300">SiteForge</div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">{t("login")}</h1>
          <p className="mt-1.5 text-sm leading-6 text-[var(--muted)]">{t("welcomeBack")}</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t("email")}</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              dir="ltr"
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("password")}</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              dir="ltr"
              autoComplete="current-password"
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
        <p className="mt-2 text-center text-xs text-stone-500 dark:text-stone-400" dir="ltr">
          demo@siteforge.local / demo1234
        </p>
      </SoftCard>
    </AppCanvas>
  );
}
