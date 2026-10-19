import { redirect } from "next/navigation";
import { getCurrentUser } from "@/services/auth";

export const dynamic = "force-dynamic";
export default async function CareerPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const session = await getCurrentUser();
  if (!session?.user || session.primaryRole !== "student") redirect("/login");
  const { view } = await searchParams;
  const selectedView = view === "scanner" || view === "builder" ? view : "resumes";
  redirect(`/student?parentTab=career&tab=career&view=${selectedView}`);
}
