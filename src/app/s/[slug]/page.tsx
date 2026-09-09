import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ensureContentDefaults, siteContentSchema } from "@/lib/design";
import { PublicSiteView } from "@/components/public-site-view";

export default async function PublicSitePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ p?: string }>;
}) {
  const { slug } = await params;
  const site = await prisma.site.findUnique({ where: { slug } });
  if (!site) notFound();

  // Public /s/ is published-only. Friendly empty state (not raw 404) when draft-only.
  if (!site.publishedContent || !site.publishedAt) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-stone-50 px-6 text-center dark:bg-stone-950">
        <div className="max-w-md rounded-[2rem] border border-stone-200 bg-white p-8 shadow-sm dark:border-stone-800 dark:bg-stone-900">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-stone-400">SiteForge</p>
          <h1 className="mt-2 text-xl font-semibold text-stone-900 dark:text-stone-50">
            الموقع غير منشور بعد
          </h1>
          <p className="mt-2 text-sm leading-6 text-stone-500 dark:text-stone-400">
            هذه الصفحة العامة تظهر بعد أول نشر من المحرر. إن كنت المالك، افتح المحرر ثم اضغط «نشر».
          </p>
          <p className="mt-1 text-sm leading-6 text-stone-500 dark:text-stone-400" dir="ltr" lang="en">
            This public page appears after the first publish from the editor.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Link
              href="/login"
              className="rounded-full bg-teal-800 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
            >
              تسجيل الدخول / Sign in
            </Link>
            <Link
              href="/dashboard"
              className="rounded-full border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-700 dark:border-stone-700 dark:text-stone-200"
            >
              لوحة التحكم
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const content = ensureContentDefaults(siteContentSchema.parse(site.publishedContent));

  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <PublicSiteView content={content} slug={slug} customCss={site.customCss} favicon={site.favicon} />
    </Suspense>
  );
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ p?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const site = await prisma.site.findUnique({
    where: { slug },
    select: {
      name: true,
      seoTitle: true,
      seoDescription: true,
      ogImage: true,
      favicon: true,
      publishedContent: true,
      publishedAt: true,
    },
  });
  if (!site) return { title: "Site not found" };
  if (!site.publishedContent || !site.publishedAt) {
    return { title: site.name ? `${site.name} (unpublished)` : "Unpublished site" };
  }

  let pageTitle: string | undefined;
  let pageDesc: string | undefined;
  let pageOg: string | undefined;
  try {
    const content = ensureContentDefaults(siteContentSchema.parse(site.publishedContent));
    const page =
      (sp.p ? content.pages.find((pg) => pg.slug === sp.p) : undefined) || content.pages[0];
    pageTitle = page?.seoTitle || undefined;
    pageDesc = page?.seoDescription || undefined;
    pageOg = page?.seoOgImage || undefined;
  } catch {
    /* ignore */
  }

  const title = pageTitle || site.seoTitle || site.name;
  const description = pageDesc || site.seoDescription || undefined;
  const og = pageOg || site.ogImage || undefined;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: og ? [og] : undefined,
    },
    icons: site.favicon ? { icon: site.favicon } : undefined,
  };
}
