import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AlbumEditorForm } from "@/components/dashboard/album-editor-form";
import { requireAdminProfile } from "@/lib/auth";
import { getOwnerClients } from "@/lib/data";
import { createAlbumAction } from "@/app/dashboard/albums/actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("albumForm");
  return { title: t("newTitle") };
}

export default async function NewAlbumPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const profile = await requireAdminProfile();
  const [t, clients] = await Promise.all([getTranslations("albumForm"), getOwnerClients(profile.id)]);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="font-display text-3xl sm:text-4xl">{t("newTitle")}</h1>
      <AlbumEditorForm action={createAlbumAction} clients={clients} error={error} />
    </div>
  );
}
