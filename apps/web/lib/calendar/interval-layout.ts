export type IntervalLayoutInput = {
  readonly id: string;
  readonly start: Date;
  readonly end: Date;
};

export type IntervalLayoutItem<TInterval extends IntervalLayoutInput> = {
  /** Original interval. The layout engine never mutates it or its Date values. */
  readonly interval: TInterval;
  /** Zero-based horizontal lane, assigned to the first lane free at `start`. */
  readonly columnIndex: number;
  /** Peak concurrency in this interval's connected collision cluster. */
  readonly columnCount: number;
  /** Unit fraction from the container's inline start. */
  readonly left: number;
  /** Unit fraction of the container occupied by this interval. */
  readonly width: number;
};

export type LayoutIntervalsInput<TInterval extends IntervalLayoutInput> = {
  readonly intervals: readonly TInterval[];
};

type ValidatedInterval<TInterval extends IntervalLayoutInput> = {
  interval: TInterval;
  startMs: number;
  /** A point interval occupies one millisecond for collision placement only. */
  layoutEndMs: number;
};

type ClusterPlacement<TInterval extends IntervalLayoutInput> = {
  entry: ValidatedInterval<TInterval>;
  columnIndex: number;
};

function compareIds(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function validateIntervals<TInterval extends IntervalLayoutInput>(
  intervals: readonly TInterval[],
): ValidatedInterval<TInterval>[] {
  const seenIds = new Set<string>();

  return intervals.map((interval) => {
    if (typeof interval.id !== "string" || interval.id.trim().length === 0) {
      throw new TypeError("Every interval must have a non-empty id.");
    }
    if (seenIds.has(interval.id)) {
      throw new RangeError(`Duplicate interval id "${interval.id}".`);
    }
    seenIds.add(interval.id);

    if (!(interval.start instanceof Date) || !(interval.end instanceof Date)) {
      throw new TypeError(
        `Interval "${interval.id}" must use a valid Date for start and end.`,
      );
    }
    const startMs = interval.start.getTime();
    const endMs = interval.end.getTime();
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
      throw new TypeError(
        `Interval "${interval.id}" must use a valid Date for start and end.`,
      );
    }
    if (endMs < startMs) {
      throw new RangeError(`Interval "${interval.id}" ends before its start.`);
    }

    return {
      interval,
      startMs,
      layoutEndMs: endMs === startMs ? startMs + 1 : endMs,
    };
  });
}

/**
 * Places half-open time intervals into equal-width columns.
 *
 * Intervals are sorted by start, then longest first, then id. A connected
 * collision cluster shares one `columnCount`, so blocks do not change width
 * partway through an overlap chain. Zero-duration intervals keep their real
 * timestamps but occupy a one-millisecond slot for collision placement.
 */
export function layoutIntervals<TInterval extends IntervalLayoutInput>({
  intervals,
}: LayoutIntervalsInput<TInterval>): IntervalLayoutItem<TInterval>[] {
  const sorted = validateIntervals(intervals).sort((left, right) => {
    const startDelta = left.startMs - right.startMs;
    if (startDelta !== 0) return startDelta;

    const endDelta = right.layoutEndMs - left.layoutEndMs;
    if (endDelta !== 0) return endDelta;

    return compareIds(left.interval.id, right.interval.id);
  });

  const layout: IntervalLayoutItem<TInterval>[] = [];
  let cluster: ClusterPlacement<TInterval>[] = [];
  let columnEnds: number[] = [];
  let clusterEnd = Number.NEGATIVE_INFINITY;

  const flushCluster = () => {
    const columnCount = columnEnds.length;
    for (const placement of cluster) {
      layout.push({
        interval: placement.entry.interval,
        columnIndex: placement.columnIndex,
        columnCount,
        left: placement.columnIndex / columnCount,
        width: 1 / columnCount,
      });
    }
    cluster = [];
    columnEnds = [];
    clusterEnd = Number.NEGATIVE_INFINITY;
  };

  for (const entry of sorted) {
    if (cluster.length > 0 && entry.startMs >= clusterEnd) {
      flushCluster();
    }

    let columnIndex = columnEnds.findIndex(
      (columnEnd) => columnEnd <= entry.startMs,
    );
    if (columnIndex === -1) {
      columnIndex = columnEnds.length;
      columnEnds.push(entry.layoutEndMs);
    } else {
      columnEnds[columnIndex] = entry.layoutEndMs;
    }

    cluster.push({ entry, columnIndex });
    clusterEnd = Math.max(clusterEnd, entry.layoutEndMs);
  }

  if (cluster.length > 0) flushCluster();

  return layout;
}
