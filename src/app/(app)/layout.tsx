import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { ImpersonationBanner } from "@/components/layout/ImpersonationBanner";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      {session.impersonatedById && (
        <ImpersonationBanner
          targetId={session.sub}
          targetName={session.name}
          targetRole={session.role}
          actorName={session.impersonatorName ?? "Super admin"}
        />
      )}
      <div className="flex flex-1 flex-col lg:flex-row">
        <Sidebar userName={session.name} role={session.role} />
        <main className="flex-1 overflow-x-hidden p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
