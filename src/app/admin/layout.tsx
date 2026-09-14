import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

/**
 * Server gate for /admin — non-ADMIN never receives the admin client page meaningfully.
 * Middleware also checks JWT role; this layout re-checks DB so stale JWTs cannot escalate.
 *
 * Security notes (FAQ):
 * - SQL injection: Prisma uses parameterized queries; no raw string SQL for user input.
 * - XSS: React escapes text; site CSS goes through sanitize helpers.
 * - This is hardening of the admin gate, not a full pentest.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/admin");
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (!dbUser || dbUser.role !== "ADMIN") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4" dir="rtl" lang="ar">
        <div className="w-full max-w-md rounded-[1.75rem] border border-[var(--border)] bg-[var(--card)] p-8 text-center shadow-[var(--shadow-xs)]">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-200">
            <span className="text-lg font-bold" aria-hidden>
              !
            </span>
          </div>
          <h1 className="text-lg font-bold text-[var(--foreground)]">غير مصرح</h1>
          <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
            لوحة الإدارة للمنصة فقط — حسابك مستأجر عادي ولا يمكنه فتح أدوات الإدارة.
          </p>
          <p className="mt-2 text-xs text-[var(--muted)]" lang="en" dir="ltr">
            403 — Admin console is for platform ADMIN role only.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-teal-800 px-5 text-sm font-bold text-white hover:bg-teal-700"
          >
            العودة للوحة التحكم
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
