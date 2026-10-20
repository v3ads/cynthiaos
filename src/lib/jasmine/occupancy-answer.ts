type Unit = { unit_id: string; status: string; unit_type: string | null; days_vacant: number | null; available_to_lease: boolean; status_warning?: string | null };
export type OccupancyResult = { units: Unit[]; source_report_date: string | null; freshness: string; warnings: string[] };

// Render the same rows used for the export. The model cannot invent a total,
// subgroup size, or add units absent from the source payload.
export function occupancyAnswer(result: OccupancyResult): string {
  const groups = new Map<string, Unit[]>();
  for (const unit of result.units) {
    const key = unit.unit_type || 'Unknown type';
    groups.set(key, [...(groups.get(key) ?? []), unit]);
  }
  return [
    `**${result.units.length} units returned**`,
    `Occupancy report as of ${result.source_report_date ?? 'unknown'} (${result.freshness}).`,
    ...result.warnings,
    ...(result.freshness === 'current' ? [] : ['Historical or unverified source: the rows below do not confirm current vacancy or leasing availability.']),
    'Vacant now, notice, and available to lease are distinct. Dashboard vacancy includes notice; leasing exclusions also apply.',
    ...Array.from(groups, ([type, units]) => `### ${type} (${units.length})\n` + units.map(u =>
      `- **Unit ${u.unit_id}** - ${u.status}${result.freshness === 'current' ? '' : ' (historical/unverified)'}; ${u.available_to_lease && result.freshness === 'current' ? 'available to lease' : 'leasing availability not confirmed'}${u.days_vacant == null ? '' : `; ${u.days_vacant} days vacant`}${u.status_warning ? `; ${u.status_warning}` : ''}`
    ).join('\n')),
  ].join('\n\n');
}

export type ToolObservation = {
  id: string; name: string; input: Record<string, unknown>; result?: unknown; failed?: boolean;
};

const listNames = new Set(['get_units', 'get_long_vacancies']);
const label = (key: string) => ({
  get_units: 'Unit list', get_long_vacancies: 'Long vacancies',
  get_portfolio_summary: 'Portfolio summary', get_unit_detail: 'Unit detail',
  source_report_date: 'Source report date', retrieved_at: 'Retrieved at (not source report date)',
  integrity_checked_at: 'Integrity checked at (not source report date)',
  last_pipeline_run: 'Pipeline run (not source report date)',
}[key] ?? key.replace(/^get_/, '').replace(/_/g, ' '));

function renderValue(value: unknown, depth = 0): string {
  if (value === null || value === undefined) return 'Unknown';
  if (typeof value !== 'object') return String(value);
  if (Array.isArray(value)) return value.length ? value.map((row, i) => `- Record ${i + 1}: ${renderValue(row, depth + 1)}`).join('\n') : 'No records returned.';
  return Object.entries(value).map(([key, entry]) => `${'  '.repeat(depth)}- **${label(key)}:** ${renderValue(entry, depth + 1)}`).join('\n');
}

export function observationList(observation: ToolObservation): OccupancyResult | null {
  if (!listNames.has(observation.name) || observation.failed) return null;
  const result = observation.result;
  // Compatibility with a backend that has not yet gained the opt-in envelope.
  if (Array.isArray(result)) return { units: result, source_report_date: null, freshness: 'unknown', warnings: ['Source report date unavailable.'] };
  if (!result || typeof result !== 'object' || !('units' in result) || !Array.isArray(result.units)) return null;
  const payload = result as OccupancyResult;
  const reportDate = typeof payload.source_report_date === 'string' ? payload.source_report_date : null;
  const age = reportDate ? Date.now() - Date.parse(reportDate) : NaN;
  const freshness = !Number.isFinite(age) || age < 0 ? 'unknown'
    : age > 48 * 3600000 ? 'stale' : payload.freshness === 'current' ? 'current' : payload.freshness === 'stale' ? 'stale' : 'unknown';
  return { units: payload.units, source_report_date: reportDate, freshness,
    warnings: Array.isArray(payload.warnings) ? payload.warnings : [] };
}

// When a turn requests unit lists, compose ALL observed results, in call order.
// A generated narrative cannot introduce a competing membership or count. Other
// requested sources (summary, detail, writes, etc.) retain their complete data
// and filters instead of being overwritten by the latest list. No-list turns
// retain their existing narrative behavior.
export function composeToolAnswer(narrative: string, observations: ToolObservation[]): string {
  if (!observations.some(o => listNames.has(o.name))) return narrative;
  return observations.map((observation, i) => {
    const filters = Object.entries(observation.input).map(([key, value]) => `${label(key)}: ${String(value)}`).join('; ');
    const title = `## ${i + 1}. ${label(observation.name)}${filters ? ` — ${filters}` : ''}`;
    if (observation.failed) return `${title}\n\nSource request failed. No result or zero count is inferred; other source results below remain independent.`;
    if (listNames.has(observation.name)) {
      const result = observationList(observation);
      return `${title}\n\n${result ? occupancyAnswer(result) : 'Source response could not be verified. No unit list or zero count is inferred.'}`;
    }
    return `${title}\n\n${renderValue(observation.result)}`;
  }).join('\n\n');
}

export function occupancyExportRows(observations: ToolObservation[]): Record<string, unknown>[] | null {
  if (!observations.some(o => listNames.has(o.name))) return null;
  return observations.flatMap(o => {
    const result = observationList(o);
    return result ? result.units.map(unit => ({ ...unit,
      available_to_lease: result.freshness === 'current' && unit.available_to_lease,
      source_call_id: o.id, source_tool: o.name, requested_filters: JSON.stringify(o.input),
      source_report_date: result.source_report_date, freshness: result.freshness })) : [];
  });
}
