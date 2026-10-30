import { renderToolObservations, type ToolObservation } from './occupancy-answer';

type RecordValue = Record<string, unknown>;
const record = (value: unknown): value is RecordValue => !!value && typeof value === 'object' && !Array.isArray(value);
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const date = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const money = (value: number) => value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const unavailable = 'Verified summary unavailable. No count or zero is inferred.';

function renewals(value: unknown): string {
  if (!record(value) || !date(value.effective_date) || !Array.isArray(value.windows) || value.windows.length !== 3 ||
      !count(value.holdovers) || !count(value.stale_closeouts)) return unavailable;
  let previous = 0;
  const lines: string[] = [];
  for (let index = 0; index < 3; index++) {
    const days = [30, 60, 90][index];
    const window = value.windows[index];
    const end = new Date(value.effective_date + 'T00:00:00Z'); end.setUTCDate(end.getUTCDate() + days);
    if (!record(window) || window.days !== days || !count(window.count) || window.count < previous ||
        window.through !== end.toISOString().slice(0, 10)) return unavailable;
    previous = window.count;
    lines.push(`- Within **${days} days**, through ${window.through}: **${window.count}**`);
  }
  return ['### Renewal decisions', `Effective date: **${value.effective_date}**. Cumulative inclusive windows.`, ...lines,
    `- Holdovers: **${value.holdovers}**; stale lease closeouts: **${value.stale_closeouts}** (lease KPI totals).`,
    'Population: soonest actionable future lease per unit; superseded, renewed/re-leased, vacating and held records excluded.',
    `Source report date: ${date(value.source_report_date) ? value.source_report_date : '**unknown**'}. Retrieval time does not establish source freshness.`,
    value.holdovers > 0 ? 'Owner follow-up: review holdovers, then the nearest renewal window. Check individual records before outreach.'
      : 'Owner follow-up: review the nearest nonempty renewal window; check individual records before outreach.'].join('\n\n');
}

function population(value: unknown): value is { total: number; by_type: Record<string, number> } {
  return record(value) && count(value.total) && record(value.by_type) &&
    Object.values(value.by_type).every(count) && Object.values(value.by_type).reduce((a, b) => Number(a) + Number(b), 0) === value.total;
}

function priorities(value: unknown): string {
  if (!record(value) || !record(value.queue_summary)) return unavailable;
  const summary = value.queue_summary;
  if (!population(summary.displayed) || !population(summary.all_open) || !Array.isArray(value.queue) ||
      value.queue.length !== summary.displayed.total || value.queue_total !== summary.displayed.total ||
      value.queue_total_open !== summary.all_open.total || summary.displayed.total > summary.all_open.total ||
      summary.truncated !== (summary.displayed.total < summary.all_open.total)) return unavailable;
  const displayed = summary.displayed;
  const allOpen = summary.all_open;
  const actual: Record<string, number> = {};
  for (const row of value.queue) {
    if (!record(row) || typeof row.type !== 'string') return unavailable;
    actual[row.type] = (actual[row.type] ?? 0) + 1;
  }
  if (Object.keys(actual).length !== Object.keys(displayed.by_type).length ||
      Object.entries(actual).some(([key, n]) => displayed.by_type[key] !== n) ||
      Object.entries(actual).some(([key, n]) => (allOpen.by_type[key] ?? 0) < n)) return unavailable;
  const labels: Record<string, string> = { overdue_turn: 'Overdue turns', renewal_due: 'Renewal actions', stale_closeout: 'Stale closeout actions' };
  const lines = (p: { total: number; by_type: Record<string, number> }) => Object.entries(p.by_type)
    .map(([type, n]) => `- ${labels[type] ?? type.replaceAll('_', ' ')}: **${n}**`).join('\n');
  return ['### Today action queue', `**${summary.all_open.total}** open actions; **${summary.displayed.total}** displayed${summary.truncated ? ' (truncated)' : ''}.`,
    'Complete open-action population:', lines(summary.all_open),
    ...(summary.truncated ? ['Displayed rows only:', lines(summary.displayed)] : []),
    'Counts are action rows, not lease KPI totals. Done/dismissed actions and future snoozes are excluded.',
    'Source report freshness is unknown; queue generation time is not an AppFolio report date.',
    (summary.all_open.by_type.overdue_turn ?? 0) > 0
      ? 'Owner follow-up: review overdue-turn actions; confirm blockers and vendor status before estimating completion.'
      : 'Owner follow-up: review the open action priorities; this queue has no overdue-turn actions.'].join('\n\n');
}

function metrics(value: unknown): string {
  if (!record(value) || !Array.isArray(value.metrics)) return unavailable;
  const lines: string[] = [];
  for (const metric of value.metrics) {
    if (!record(metric) || typeof metric.label !== 'string' || typeof metric.metric_id !== 'string' ||
        !['trusted', 'warning', 'blocked'].includes(String(metric.confidence)) ||
        (metric.value !== null && (typeof metric.value !== 'number' || !Number.isFinite(metric.value)))) return unavailable;
    const blocked = metric.confidence === 'blocked' || ['noi_ytd', 'profit_margin_ytd'].includes(metric.metric_id);
    const n = metric.value as number | null;
    const display = blocked ? 'unavailable' : n === null ? 'unknown' : /_rate$/.test(metric.metric_id)
      ? `${(n * 100).toFixed(1)}%` : /income|exposure/.test(metric.metric_id) ? money(n) : String(n);
    lines.push(`- ${metric.label}: **${display}** (${blocked ? 'blocked' : metric.confidence}); source report: ${date(metric.source_freshness) ? metric.source_freshness : 'unknown'}.`);
  }
  return ['### Management metrics', ...lines,
    'Vacancy rate includes notice. NOI and margin are unavailable as property performance because expenses are paid externally.',
    record(value.renewal_summary) ? renewals(value.renewal_summary) : 'Renewal-window counts unavailable from this backend; no manual buckets inferred.'].join('\n\n');
}

function income(value: unknown): string {
  if (!record(value) || !record(value.latest) || value.cache_status !== 'live') return unavailable;
  const latest = value.latest;
  if (!date(latest.report_date) || !record(latest.mtd)) return unavailable;
  const format = (n: unknown) => typeof n === 'number' && Number.isFinite(n) ? money(n) : 'unknown';
  return ['### Income', `Source report: **${latest.report_date}**. Live Gold read shared with Financials.`,
    `- MTD income: **${format(latest.mtd.total_income)}**`, `- YTD income: **${format(latest.total_income)}**`,
    'NOI and profit margin are unavailable as full property performance: expenses are paid externally.'].join('\n\n');
}

// Owner statistics are rendered from structured facts, not model arithmetic.
// Keep the exact assistant response untouched in model history.
export function composeOwnerAnswer(observations: ToolObservation[]): string | null {
  const renderers: Record<string, (value: unknown) => string> = {
    get_management_metrics: metrics, get_today_priorities: priorities, get_income_statement: income,
    get_expiring_leases: value => Array.isArray(value)
      ? `### Expiring-lease retrieval\n\n**${value.length}** records returned for the requested window. Use Management metrics for verified 30/60/90-day buckets; other windows are not inferred from this list.` : unavailable,
  };
  const selected = observations.filter(o => o.name in renderers);
  if (!selected.length) return null;
  const other = observations.filter(o => !(o.name in renderers));
  return [...selected.map(o => {
    if (o.failed) return unavailable;
    if (o.name === 'get_expiring_leases' && Array.isArray(o.result)) {
      const days = count(o.input.window_days) && o.input.window_days > 0 && o.input.window_days <= 90 ? o.input.window_days : 90;
      return `### Expiring-lease retrieval — next ${days} days\n\n**${o.result.length}** records returned. Use Management metrics for verified cumulative 30/60/90-day buckets; other windows are not inferred from this list.`;
    }
    return renderers[o.name](o.result);
  }),
    ...(other.length ? [renderToolObservations(other)] : [])].join('\n\n');
}
