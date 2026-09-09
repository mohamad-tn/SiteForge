"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { usePlatformLang } from "@/components/platform-lang-provider";

export function SignOutButton() {
  const { t } = usePlatformLang();
  return (
    <Button variant="ghost" size="sm" className="rounded-full" onClick={() => signOut({ callbackUrl: "/" })}>
      {t("signOut")}
    </Button>
  );
}
