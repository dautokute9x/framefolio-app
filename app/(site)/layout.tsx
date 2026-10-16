import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

// Public pages (home, portfolio, login). Client galleries and the dashboard
// have their own chrome.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
