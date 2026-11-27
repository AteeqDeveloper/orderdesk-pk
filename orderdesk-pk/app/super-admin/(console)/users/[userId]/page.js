import SuperAdminUserDetail from "@/components/super-admin/SuperAdminUserDetail";

export const metadata = { title: "User details — Super Admin · OrderDesk PK" };

export default async function SuperAdminUserPage(props) {
  const params = await props.params;
  return <SuperAdminUserDetail userId={params?.userId} />;
}
