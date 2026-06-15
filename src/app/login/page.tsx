import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { verifyAccessCode } from "./actions";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await getSession();
  if (session.isAuthenticated) redirect("/");

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <div className="bg-white border border-neutral-200 rounded-xl p-8 w-full max-w-sm shadow-sm">
        <h1 className="text-xl font-semibold text-neutral-900 mb-1">Partnerships</h1>
        <p className="text-sm text-neutral-500 mb-6">Enter your access code to continue.</p>
        <LoginForm action={verifyAccessCode} />
      </div>
    </div>
  );
}
