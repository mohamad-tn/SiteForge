import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ensureContentDefaults, siteContentSchema } from "@/lib/design";
import { PublicSiteView } from "@/components/public-site-view";

/** Authenticated draft preview — never a substitute for public /s/[slug]. */
export default async function EditorDraftPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const site = await prisma.site.findFirst({ where: { id, ownerId: user.id } });
  if (!site) notFound();

  const content = ensureContentDefaults(siteContentSchema.parse(site.draftContent));

  return (
    <div className="min-h-screen bg-stone-100 dark:bg-stone-950">
      <div className="sticky top-0 z-50 flex items-center justify-between gap-3 border-b border-amber-500/30 bg-amber-50/95 px-4 py-2 text-sm backdrop-blur dark:bg-amber-950/90">
        <div className="min-w-0">
          <span className="rounded-full bg-amber-600 px-2 py-0.5 text-[10px] font-bold text-white">
            مسودة / Draft
          </span>
          <span className="ms-2 truncate font-semibold text-amber-950 dark:text-amber-50">
            {site.name}
          </span>
          <span className="ms-2 hidden text-[11px] text-amber-900/70 sm:inline dark:text-amber-100/70">
            معاينة خاصة للمالك — ليست الصفحة العامة
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`/editor/${site.id}`}
            className="rounded-full bg-stone-900 px-3 py-1.5 text-xs font-semibold text-white dark:bg-stone-100 dark:text-stone-900"
          >
            ← المحرر
          </Link>
          {site.publishedAt ? (
            <Link
              href={`/s/${site.slug}`}
              target="_blank"
              className="rounded-full border border-amber-700/30 px-3 py-1.5 text-xs font-semibold text-amber-950 dark:text-amber-50"
            >
              العرض العام
            </Link>
          ) : null}
        </div>
      </div>
      <PublicSiteView content={content} slug={site.slug} customCss={site.customCss} favicon={site.favicon} />
    </div>
  );
}
