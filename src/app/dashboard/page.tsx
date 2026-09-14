import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { DashboardClient } from "@/components/dashboard-client";
import { redirect } from "next/navigation";

type SearchParams = { tenant?: string };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const user = await requireUser();
  const sp = (await searchParams) ?? {};

  // Admins land on platform ops by default; ?tenant=1 is the escape hatch.
  if (user.role === "ADMIN" && sp.tenant !== "1") {
    redirect("/admin");
  }

  const templates = await prisma.template.findMany({
    orderBy: { nameAr: "asc" },
    select: {
      id: true,
      slug: true,
      nameAr: true,
      descriptionAr: true,
      category: true,
      thumbnail: true,
    },
  });
  const categories = Array.from(new Set(templates.map((t) => t.category)));

  return (
    <DashboardClient
      userName={user.name}
      userEmail={user.email}
      isAdmin={user.role === "ADMIN"}
      initialTemplates={templates}
      categories={categories}
    />
  );
}
