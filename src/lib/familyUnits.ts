// ─── Family Unit Configuration ───────────────────────────────────────────────
// Apartments arranged for the Picinich family.
// 115, 116, 318 are occupied; 202 and 313 are intentionally held vacant.
// All three occupied leases expire on the same date — renew together.

export const FAMILY_UNIT_IDS = new Set(['115', '116', '202', '313', '318']);

export const FAMILY_UNIT_LABEL: Record<string, string> = {
  '115': 'Family · Picinich',
  '116': 'Family · Picinich',
  '202': 'Family · Held Vacant',
  '313': 'Family · Held Vacant',
  '318': 'Family · Picinich',
};

export const FAMILY_GROUP_NAME = 'Picinich Family';

/** Sort family units adjacent to each other, preserving relative order within groups */
export function sortWithFamilyGrouped<T extends { unit_id?: string; unit?: string }>(
  records: T[],
  getUnitId: (r: T) => string
): T[] {
  const family = records.filter(r => FAMILY_UNIT_IDS.has(getUnitId(r)));
  const others = records.filter(r => !FAMILY_UNIT_IDS.has(getUnitId(r)));
  // Insert family block at the top (after any HIGH urgency items if present)
  return [...others.slice(0, 0), ...family, ...others];
}
