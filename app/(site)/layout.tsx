import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

// Marketing pages (home, portfolio, login) get the public header/footer.
// Client galleries and the dashboard have their own chrome; the global sticky
// header used to cover the gallery's sticky selection bar on phones.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}
