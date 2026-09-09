import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { DashboardClient } from "@/components/dashboard-client";

export default async function DashboardPage() {
  const user = await requireUser();
  const templates = await prisma.template.findMany({
    orderBy: { nameAr: "asc" },
    select: {
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
