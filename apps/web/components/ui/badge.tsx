import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-label font-medium",
  {
    variants: {
      variant: {
        default: "border-border bg-surface-raised text-ink",
        high: "border-brick bg-brick-tint text-ink",
        medium: "border-border-strong bg-surface-raised text-ink",
        low: "border-meadow bg-meadow-tint text-ink",
        muted: "border-border bg-paper text-text-secondary",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, className }))} {...props} />
  );
}

export { badgeVariants };
