type TaskFileBoxIllustrationProps = {
  active?: boolean;
};

/** Signature-law line-art file box for task cards (Lumis craft reference). */
export function TaskFileBoxIllustration({
  active = false,
}: TaskFileBoxIllustrationProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 120 72"
      className={`h-16 w-24 ${active ? "text-text-secondary" : "text-text-muted/70"}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M18 24h84v38H18V24Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M18 24 36 14h48l18 10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M36 14v10H18M84 14v10h18"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M34 38h52M34 46h36"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        opacity={active ? 1 : 0.55}
      />
      <path
        d="M46 30h28"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        opacity={active ? 0.85 : 0.45}
      />
    </svg>
  );
}
