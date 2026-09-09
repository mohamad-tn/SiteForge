import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { ensureContentDefaults, siteContentSchema } from "@/lib/design";
import { jsonError, requireSession, requireSiteAccess } from "@/lib/api";

export async function POST(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  const access = await requireSiteAccess(id, auth.user);
  if ("response" in access) return access.response;
  const existing = access.site;

  try {
    const content = ensureContentDefaults(siteContentSchema.parse(existing.draftContent));
    const slug = `${existing.slug}-copy-${nanoid(4).toLowerCase()}`;
    const site = await prisma.site.create({
      data: {
        name: `${existing.name} (copy)`,
        slug,
        ownerId: auth.user.id,
        draftContent: content as object,
        seoTitle: existing.seoTitle,
        seoDescription: existing.seoDescription,
        ogImage: existing.ogImage,
        favicon: existing.favicon,
        customCss: existing.customCss,
      },
    });
    return NextResponse.json({ site });
  } catch (e) {
    console.error(e);
    return jsonError("Server error", 500);
  }
}
