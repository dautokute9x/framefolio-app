import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { requireAdminProfile } from "@/lib/auth";
import { getInboxCount } from "@/lib/data";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireAdminProfile();
  const inboxCount = await getInboxCount(profile.id);
  return (
    <DashboardShell profile={profile} inboxCount={inboxCount}>
      {children}
    </DashboardShell>
  );
}
