"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { openSpotlight } from "@/features/command-bar/spotlight-bridge";

function SearchRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const query = searchParams.get("q")?.trim() || undefined;
    openSpotlight(query);
    if (window.history.length > 1) {
      router.back();
    } else {
      router.replace("/");
    }
  }, [router, searchParams]);

  return (
    <div className="flex min-h-full items-center justify-center px-5 py-12">
      <p className="text-small text-text-muted">Opening search…</p>
    </div>
  );
}

/**
 * Legacy /search route — opens Spotlight and returns to the previous surface.
 * Keeps old bookmarks and command links working after the top-bar search removal.
 */
export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-full items-center justify-center px-5 py-12">
          <p className="text-small text-text-muted">Opening search…</p>
        </div>
      }
    >
      <SearchRedirect />
    </Suspense>
  );
}
