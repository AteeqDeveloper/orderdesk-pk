import SuperAdminUserDetail from "@/components/super-admin/SuperAdminUserDetail";

export const metadata = { title: "User details — Super Admin · OrderDesk PK" };

export default function SuperAdminUserPage({ params }) {
  return <SuperAdminUserDetail userId={params.userId} />;
}
