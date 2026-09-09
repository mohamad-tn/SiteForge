import { Suspense } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ensureContentDefaults, siteContentSchema } from "@/lib/design";
import { PublicSiteView } from "@/components/public-site-view";

export default async function ByDomainPage() {
  const h = await headers();
  const domain = (h.get("x-siteforge-domain") || "").toLowerCase().trim();
  if (!domain) notFound();

  const site = await prisma.site.findFirst({
    where: {
      customDomain: domain,
      domainStatus: { in: ["pending", "active"] },
    },
  });
  if (!site || !site.publishedContent) notFound();

  const content = ensureContentDefaults(siteContentSchema.parse(site.publishedContent));

  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <PublicSiteView
        content={content}
        slug={site.slug}
        customCss={site.customCss}
        favicon={site.favicon}
      />
    </Suspense>
  );
}

export async function generateMetadata() {
  const h = await headers();
  const domain = (h.get("x-siteforge-domain") || "").toLowerCase().trim();
  if (!domain) return { title: "Site" };
  const site = await prisma.site.findFirst({
    where: { customDomain: domain },
    select: { name: true, seoTitle: true, seoDescription: true },
  });
  return {
    title: site?.seoTitle || site?.name || domain,
    description: site?.seoDescription || undefined,
  };
}
