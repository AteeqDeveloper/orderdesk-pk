import Link from "next/link";
import AuthCard from "@/components/auth/AuthCard";
import RegisterForm from "@/components/auth/RegisterForm";

export const metadata = {
  title: "Create account — OrderDesk PK",
};

export default function RegisterPage() {
  return (
    <AuthCard
      title="Set up your shop"
      subtitle="Start managing orders, stock and customers in one place."
      footer={
        <p>
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-brand-700 hover:text-brand-800"
          >
            Log in
          </Link>
        </p>
      }
    >
      <RegisterForm />
    </AuthCard>
  );
}
