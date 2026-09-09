"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "@/components/theme-provider";
import { PlatformLangProvider } from "@/components/platform-lang-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <PlatformLangProvider>{children}</PlatformLangProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
