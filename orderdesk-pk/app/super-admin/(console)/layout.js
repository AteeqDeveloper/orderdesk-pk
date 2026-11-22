import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/serverApi";
import SuperAdminShell from "@/components/super-admin/SuperAdminShell";

export default async function SuperAdminLayout({ children }) {
  const user = await getServerUser();
  if (!user) redirect("/super-admin/login");
  if (user.role !== "super_admin") redirect("/dashboard");

  return <SuperAdminShell user={user}>{children}</SuperAdminShell>;
}
