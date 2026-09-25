import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LogoutButton } from "../dashboard/logout-button";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = getSession();
  if (!session || session.role !== "ADMIN") {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <span className="text-lg font-bold text-brand-700">E-Voting Kampus — Admin</span>
          <div className="flex items-center gap-4 text-sm text-slate-600">
            <span>{session.name}</span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-8">{children}</main>
    </div>
  );
}
