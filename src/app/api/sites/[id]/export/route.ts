import { NextResponse } from "next/server";
import { ensureContentDefaults, siteContentSchema } from "@/lib/design";
import { jsonError, requireSession, requireSiteAccess } from "@/lib/api";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  const access = await requireSiteAccess(id, auth.user);
  if ("response" in access) return access.response;
  const site = access.site;

  try {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      name: site.name,
      slug: site.slug,
      seoTitle: site.seoTitle,
      seoDescription: site.seoDescription,
      ogImage: site.ogImage,
      favicon: site.favicon,
      customCss: site.customCss,
      content: ensureContentDefaults(siteContentSchema.parse(site.draftContent)),
    };
    return NextResponse.json(payload);
  } catch (e) {
    console.error(e);
    return jsonError("Export failed", 500);
  }
}
