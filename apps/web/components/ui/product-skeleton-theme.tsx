"use client";

import type { ReactNode } from "react";
import { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

type ProductSkeletonThemeProps = {
  children: ReactNode;
  /** Defaults to paper-product neutrals. Files can pass files tokens. */
  baseColor?: string;
  highlightColor?: string;
  borderRadius?: string | number;
};

/**
 * Shared react-loading-skeleton theme wired to Planevo CSS tokens so a palette
 * swap stays a one-file edit (no hardcoded hex in product skeletons).
 */
export function ProductSkeletonTheme({
  children,
  baseColor = "var(--color-sidebar)",
  highlightColor = "var(--color-surface-raised)",
  borderRadius = "0.375rem",
}: ProductSkeletonThemeProps) {
  return (
    <SkeletonTheme
      baseColor={baseColor}
      highlightColor={highlightColor}
      borderRadius={borderRadius}
    >
      {children}
    </SkeletonTheme>
  );
}
