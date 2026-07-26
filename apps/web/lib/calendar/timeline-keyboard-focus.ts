export type TimelineNavigationKey = "ArrowUp" | "ArrowDown" | "Home" | "End";

export function nextTimelineFocusIndex({
  key,
  currentIndex,
  itemCount,
}: {
  key: TimelineNavigationKey;
  currentIndex: number;
  itemCount: number;
}): number | null {
  if (itemCount <= 0) return null;

  switch (key) {
    case "ArrowUp":
      return Math.max(0, currentIndex - 1);
    case "ArrowDown":
      return Math.min(itemCount - 1, currentIndex + 1);
    case "Home":
      return 0;
    case "End":
      return itemCount - 1;
    default: {
      const exhaustive: never = key;
      return exhaustive;
    }
  }
}
