import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { requireAdminProfile } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireAdminProfile();
  return <DashboardShell profile={profile}>{children}</DashboardShell>;
}
