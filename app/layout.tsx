import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Toaster } from "sonner";
import { getBrand } from "@/lib/brand";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  variable: "--font-inter",
});

const playfair = Playfair_Display({
  subsets: ["latin", "vietnamese"],
  variable: "--font-playfair",
});

export async function generateMetadata(): Promise<Metadata> {
  const [t, brand] = await Promise.all([getTranslations("meta"), getBrand()]);
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL?.startsWith("http") ? process.env.NEXT_PUBLIC_SITE_URL : "http://localhost:3000"),
    title: { default: brand.name, template: `%s · ${brand.name}` },
    description: t("description"),
  };
}

export const viewport: Viewport = {
  themeColor: "#f9f7f3",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body className={`${inter.variable} ${playfair.variable} font-sans`}>
        <NextIntlClientProvider>
          {children}
          <Toaster position="top-center" richColors closeButton />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
