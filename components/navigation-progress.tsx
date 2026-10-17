"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type Phase = "idle" | "loading" | "finishing";

/**
 * Thin bar at the top of the screen while the next page loads. Starts on a
 * click on an internal link (or back/forward) and completes when the URL changes.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState<Phase>("idle");
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };

  // The new page is on screen: run the bar to the end, then hide it.
  useEffect(() => {
    setPhase((current) => (current === "loading" ? "finishing" : current));
  }, [pathname, searchParams]);

  useEffect(() => {
    clearTimers();
    if (phase === "finishing") timers.current.push(window.setTimeout(() => setPhase("idle"), 350));
    // Never leave the bar stuck (e.g. a link that turned out to stay on this page).
    if (phase === "loading") timers.current.push(window.setTimeout(() => setPhase("finishing"), 15_000));
    return clearTimers;
  }, [phase]);

  useEffect(() => {
    const start = () => setPhase("loading");

    // Capture phase: Next's <Link> calls preventDefault() on the click, so a
    // bubbling listener would never see a normal link navigation.
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a");
      if (!anchor || !anchor.href || anchor.hasAttribute("download")) return;
      if (anchor.target && anchor.target !== "_self") return;
      const next = new URL(anchor.href, window.location.href);
      if (next.origin !== window.location.origin) return;
      // Same page (or only a #hash change): nothing to wait for.
      if (next.pathname === window.location.pathname && next.search === window.location.search) return;
      if (next.pathname.startsWith("/api/")) return;
      start();
    };

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", start);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", start);
    };
  }, []);

  return (
    <div
      aria-hidden
      data-navigation-progress={phase}
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]"
    >
      <div
        className="h-full bg-accent shadow-[0_0_8px_hsl(var(--accent))]"
        style={{
          width: phase === "idle" ? "0%" : phase === "loading" ? "85%" : "100%",
          opacity: phase === "idle" ? 0 : 1,
          // Quick first jump, then a slow crawl, so short loads still feel responsive.
          transition:
            phase === "loading"
              ? "width 8s cubic-bezier(0.1, 0.8, 0.2, 1), opacity 0.1s"
              : phase === "finishing"
                ? "width 0.2s ease-out, opacity 0.3s ease 0.15s"
                : "none",
        }}
      />
    </div>
  );
}
