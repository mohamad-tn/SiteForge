import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ensureContentDefaults, siteContentSchema } from "@/lib/design";
import { EditorShell } from "@/components/editor/editor-shell";

export default async function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const site = await prisma.site.findFirst({ where: { id, ownerId: user.id } });
  if (!site) notFound();

  const content = ensureContentDefaults(siteContentSchema.parse(site.draftContent));

  return (
    <EditorShell
      site={{
        id: site.id,
        name: site.name,
        slug: site.slug,
        publishedAt: site.publishedAt?.toISOString() ?? null,
        seoTitle: site.seoTitle || "",
        seoDescription: site.seoDescription || "",
        ogImage: site.ogImage || "",
        favicon: site.favicon || "",
        customCss: site.customCss || "",
        customDomain: site.customDomain || "",
        domainStatus: site.domainStatus || "none",
      }}
      initialContent={content}
    />
  );
}
