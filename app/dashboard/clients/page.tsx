import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ClientList } from "@/components/dashboard/client-list";
import { requireAdminProfile } from "@/lib/auth";
import { getClientsWithAlbums } from "@/lib/data";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("clients");
  return { title: t("title") };
}

export default async function ClientsPage() {
  const profile = await requireAdminProfile();
  const [t, clients] = await Promise.all([getTranslations("clients"), getClientsWithAlbums(profile.id)]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle", { count: clients.length })}</p>
      </div>
      <ClientList clients={clients} />
    </div>
  );
}
