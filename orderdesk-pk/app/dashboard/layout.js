import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/serverApi";
import DashboardShell from "@/components/layout/DashboardShell";

export default async function DashboardLayout({ children }) {
  const user = await getServerUser();
  if (!user) {
    redirect("/login");
  }

  const profile = {
    full_name: user.fullName,
    business_name: user.businessName,
  };

  return (
    <DashboardShell user={user} profile={profile}>
      {children}
    </DashboardShell>
  );
}
