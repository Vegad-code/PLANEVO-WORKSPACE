const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    BYTE_UNITS.length - 1,
  );
  const value = bytes / 1024 ** exponent;
  const rounded = value >= 10 || exponent === 0 ? Math.round(value) : value.toFixed(1);
  return `${rounded} ${BYTE_UNITS[exponent]}`;
}

type StorageMeterProps = {
  usedBytes: number;
  capBytes: number;
};

export function StorageMeter({ usedBytes, capBytes }: StorageMeterProps) {
  const usedRatio = capBytes > 0 ? Math.min(usedBytes / capBytes, 1) : 0;
  const label = `${formatBytes(usedBytes)} of ${formatBytes(capBytes)} used`;

  return (
    <div aria-label="Storage" className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-product-title text-ink">Storage</span>
        <span className="text-product-meta tabular-nums text-text-secondary">
          {label}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={capBytes}
        aria-valuenow={Math.min(usedBytes, capBytes)}
        aria-valuetext={label}
        className="h-1.5 w-full overflow-hidden rounded-full bg-border"
      >
        <div
          style={{ width: `${usedRatio * 100}%` }}
          className="h-full rounded-full bg-ink"
        />
      </div>
    </div>
  );
}
