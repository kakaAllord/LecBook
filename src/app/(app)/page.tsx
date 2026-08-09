import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SuperAdminDashboard } from "./_dashboards/SuperAdminDashboard";
import { AdminDashboard } from "./_dashboards/AdminDashboard";
import { LecturerDashboard } from "./_dashboards/LecturerDashboard";

/**
 * Three different dashboards behind one route. The super admin gets the usage
 * of the product, the admin the shape of the institution, the lecturer their
 * own teaching — nobody is shown a number they cannot act on.
 */
export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  if (session.role === "SUPER_ADMIN") return <SuperAdminDashboard />;
  if (session.role === "ADMIN") return <AdminDashboard />;
  return <LecturerDashboard firstName={session.name.split(" ")[0]} />;
}
