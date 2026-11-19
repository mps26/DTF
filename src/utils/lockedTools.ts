/**
 * Tool categories that are locked for everyone. Their menus stay visible (with a
 * lock icon) but cannot be opened, and their tools cannot be launched.
 * To unlock a category later, remove its id here (and its tools below).
 */
export const LOCKED_CATEGORY_IDS = new Set<string>(['style', 'create']);

/** Tools inside the locked categories (top bar + Design Studio tabs). */
export const LOCKED_TOOL_IDS = new Set<string>([
  // Style & Effects
  'texture',
  'halftone',
  'stroke-outline',
  // Create & Convert
  'tiff-export',
  'text-number',
  'vectorize',
  'recreate-ai',
  'guide'
]);

export const isCategoryLocked = (categoryId: string) => LOCKED_CATEGORY_IDS.has(categoryId);
export const isToolLocked = (toolId: string) => LOCKED_TOOL_IDS.has(toolId);
