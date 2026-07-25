/**
 * Month owns its overflow agenda. RBC must not open its overlay or implicitly
 * drill into Day, and its drag-and-drop addon stays disabled for Month items.
 */
export const MONTH_GRID_BEHAVIOR = {
  popup: false,
  doShowMoreDrillDown: false,
  draggable: false,
  resizable: false,
} as const
