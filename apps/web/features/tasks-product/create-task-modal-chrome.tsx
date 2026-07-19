import { cn } from "@/lib/utils";

type CornerBracketFrameProps = {
  children: React.ReactNode;
  className?: string;
  bracketClassName?: string;
  /** Tailwind size utility for each L-bracket arm (e.g. size-1.5, size-3). */
  bracketSize?: string;
};

const bracketPositions = [
  "top-0 left-0 border-t border-l",
  "top-0 right-0 border-t border-r",
  "bottom-0 left-0 border-b border-l",
  "bottom-0 right-0 border-b border-r",
] as const;

/**
 * Lumis crop-mark frame — four L-brackets at the corners, no full box border.
 */
export function CornerBracketFrame({
  children,
  className,
  bracketClassName,
  bracketSize = "size-2.5",
}: CornerBracketFrameProps) {
  return (
    <div className={cn("relative", className)}>
      {bracketPositions.map((position) => (
        <span
          key={position}
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute border-ink",
            bracketSize,
            position,
            bracketClassName,
          )}
        />
      ))}
      {children}
    </div>
  );
}

type LumisDotGridBandProps = {
  className?: string;
};

/**
 * Lumis attachment footer — faint square-dot grid band.
 */
export function LumisDotGridBand({ className }: LumisDotGridBandProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("lumis-dot-grid pointer-events-none", className)}
    />
  );
}
