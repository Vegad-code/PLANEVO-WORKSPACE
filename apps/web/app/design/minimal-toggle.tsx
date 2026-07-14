"use client";

import { useState } from "react";

export function MinimalToggle() {
  const [minimal, setMinimal] = useState(false);

  function toggle() {
    document.documentElement.toggleAttribute("data-minimal");
    setMinimal((m) => !m);
  }

  return (
    <button
      onClick={toggle}
      className="rounded-full border border-border-strong px-4 py-1.5 text-small hover:bg-surface-raised"
    >
      Minimal mode: {minimal ? "on" : "off"}
    </button>
  );
}
