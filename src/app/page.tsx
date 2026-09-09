import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { HomeLanding } from "@/components/home-landing";

export default async function HomePage() {
  const session = await getSession();
  if (session?.user) redirect("/dashboard");
  return <HomeLanding />;
}
