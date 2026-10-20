import { composeToolAnswer, occupancyExportRows, type ToolObservation } from '@/lib/jasmine/occupancy-answer';
import Anthropic from '@anthropic-ai/sdk';
import { JASMINE_TOOLS } from '@/lib/jasmine/tools';
import { executeTool } from '@/lib/jasmine/executor';
import { createClient } from '@/lib/supabase/server';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PROPERTY_TIME_ZONE = 'America/New_York';

type DateContext = {
  isoDate: string;
  displayDate: string;
  monthStart: string;
  monthEnd: string;
  yearStart: string;
  yearEnd: string;
};

function toIsoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getDateContext(now = new Date()): DateContext {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: PROPERTY_TIME_ZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'long',
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';

  const year = Number(value('year'));
  const month = Number(value('month'));
  const day = Number(value('day'));
  const monthEndDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return {
    isoDate: toIsoDate(year, month, day),
    displayDate: new Intl.DateTimeFormat('en-US', {
      timeZone: PROPERTY_TIME_ZONE,
      dateStyle: 'full',
    }).format(now),
    monthStart: toIsoDate(year, month, 1),
    monthEnd: toIsoDate(year, month, monthEndDay),
    yearStart: toIsoDate(year, 1, 1),
    yearEnd: toIsoDate(year, 12, 31),
  };
}

function resolveRelativeMoveScheduleInput(
  input: Record<string, unknown>,
  query: string,
  now = new Date()
): Record<string, unknown> {
  if (input.start_date || input.end_date || input.window_days !== undefined) return input;

  const normalizedQuery = query.toLowerCase();
  const dateContext = getDateContext(now);

  if (/\b(?:this|current)\s+month\b/.test(normalizedQuery)) {
    return { ...input, start_date: dateContext.monthStart, end_date: dateContext.monthEnd };
  }

  if (/\b(?:this|current)\s+year\b/.test(normalizedQuery)) {
    return { ...input, start_date: dateContext.yearStart, end_date: dateContext.yearEnd };
  }

  return input;
}

function currentDateInstruction(now = new Date()): string {
  const dateContext = getDateContext(now);
  return `AUTHORITATIVE CURRENT DATE: ${dateContext.displayDate} (${PROPERTY_TIME_ZONE}; ISO ${dateContext.isoDate}).
- Never infer today's date or year from training data, static examples, prior conversation text, or source-record dates; use this value.
- For “this month” or “current month”, use ${dateContext.monthStart} through ${dateContext.monthEnd}.
- For “this year” or “current year”, use ${dateContext.yearStart} through ${dateContext.yearEnd}.
- For other relative dates, calculate from the authoritative current date above and state the resolved date range when it affects an answer.`;
}

const SYSTEM_PROMPT =
  `You are Jasmine, the AI property management assistant for Cynthia Gardens.

Your primary users are:
- Ayman: owner and operations lead. Wants concise numbers and financial insight.
- Cindy: property manager. Wants actionable detail on units, tenants, and tasks.
- Leasing team: wants vacancy, availability, and prospect-ready information.

You have access to imported AppFolio data via tools. Retrieval time is not source freshness.
Always call the most relevant tool before answering — never guess at numbers.
If a question requires more than one tool, call all of them before responding.

MANAGEMENT METRICS:
- For headline management numbers (occupancy, vacancy, renewals due, holdovers, collections exposure, income, NOI, margin, open maintenance, turns), prefer get_management_metrics. When you quote such a value, briefly note what it means and its as-of freshness, and flag its confidence: if a metric is "blocked" or "warning", say so rather than presenting it as clean.
- NOI and profit margin are structurally BLOCKED: property expenses are paid through an external system, not AppFolio. Never present a computed NOI or margin as real property performance — explain that expenses are external and only income is authoritative.
- For "what needs attention / what's on my plate", use get_today_priorities.

CREATING TASKS:
- When Cindy asks you to remind her, add a task, or follow up on something, use create_action, then confirm exactly what you created (title, due date if any). This adds it to the same queue she sees on Today and Tasks.

RESPONSE STYLE:
- Lead with the key number or direct answer on the first line.
- Use markdown formatting to make responses readable:
  - Use **bold** for key numbers, unit IDs, tenant names, and totals.
  - Use bullet lists (- item) for any list of 3 or more items. Format each item as: **Unit NNN** — Tenant Name — $balance — detail
  - Use ### for section headers when a response has multiple sections.
  - Use a markdown table ONLY when explicitly comparing 4+ attributes across multiple items (e.g. a side-by-side unit comparison). For lists of tenants or delinquency accounts, always use bullet lists instead of tables.
- Format rent amounts with $ and commas e.g. $1,850.
- Format dates as Month DD, YYYY e.g. July 31, 2026.
- Keep answers tight. Ayman and Cindy are reading on mobile.
- If data is empty (e.g. no move-ins this month), say so directly.

BUSINESS RULES YOU MUST KNOW:
- Read the roster size and occupancy denominator from the tools. Never use a fixed historical unit count.
- Preserve family/employee holdings and leasing/revenue exclusions returned by the tools. A held unit is not necessarily physically occupied or available to lease.
- For occupancy freshness use source_report_date and freshness from get_portfolio_summary. Warn on stale/unknown reports. Never call retrieval or integrity-check time the source report date. Unit list responses contain authoritative units and counts; do not add units or calculate counts from memory. Notice is separate from vacant now. Availability requires explicit leasing evidence and applicable overrides.
- Student units have a dash in the unit number. The only current student unit in the canonical roster is 120-a.
- When asked about the general ledger for a specific month or period, always pass start_date and end_date to get_general_ledger to avoid fetching all 2,000+ rows.
- get_income_statement returns both the latest full-period figures and month-to-date (MTD) figures. Use the mtd fields when asked about the current month.`.trim();

// Tools that return arrays suitable for CSV export
const LIST_TOOLS = new Set([
  'get_units',
  'get_expiring_leases',
  'get_notices',
  'get_delinquency',
  'get_below_market_units',
  'get_long_vacancies',
  'search_tenants',
  'get_move_schedule',
  'get_open_tasks',
  'get_unit_overrides',
  // New report tools
  'get_aged_receivables',
  'get_applicants',
  'get_inspections',
  'get_general_ledger',
  'get_vendors',
  'get_prospects',
  'get_work_orders',
]);

function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  return [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join(
    '\n'
  );
}

const MAX_ROUNDS = 5;

export async function POST(req: Request) {
  try {
    // The Jasmine route is a data + command path (it reads the Gold layer and
    // can create actions), so it must not be an open relay. Require an
    // authenticated session and act on behalf of that user: resolve their
    // Supabase access token and forward it through every backend tool call.
    let accessToken: string | null = null;
    try {
      const supabase = await createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      accessToken = session?.access_token ?? null;
    } catch {
      accessToken = null;
    }
    if (!accessToken) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { query, history = [] } = await req.json();

    if (!query || typeof query !== 'string') {
      return Response.json({ error: 'query is required' }, { status: 400 });
    }

    const messages: Anthropic.MessageParam[] = [...history, { role: 'user', content: query }];

    let rounds = 0;
    let csvData: string | null = null;
    let csvLabel = 'jasmine-export';
    const observations: ToolObservation[] = [];

    while (rounds < MAX_ROUNDS) {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 2048,
        system: `${SYSTEM_PROMPT}\n\n${currentDateInstruction()}`,
        tools: JASMINE_TOOLS,
        messages,
      });

      messages.push({ role: 'assistant', content: response.content });

      if (response.stop_reason === 'end_turn') {
        let answer = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('');

        // If no tool CSV was captured, try to extract a CSV from any markdown table in the answer
        if (!csvData && occupancyExportRows(observations) === null) {
          const tableMatch = answer.match(
            /\|(.+)\|[\s\S]*?(?:\n\|[-| :]+\|)[\s\S]*?((?:\n\|.+\|)+)/
          );
          if (tableMatch) {
            const lines = answer.split('\n').filter((l) => l.trim().startsWith('|'));
            const nonSep = lines.filter((l) => !/^\|[-| :]+\|$/.test(l.trim()));
            if (nonSep.length >= 2) {
              const parseRow = (l: string) =>
                l
                  .split('|')
                  .slice(1, -1)
                  .map((c) => c.trim());
              const headers = parseRow(nonSep[0]);
              const dataRows = nonSep.slice(1);
              const escape = (v: string) =>
                v.includes(',') || v.includes('"') || v.includes('\n')
                  ? `"${v.replace(/"/g, '""')}"`
                  : v;
              csvData = [
                headers.map(escape).join(','),
                ...dataRows.map((r) => parseRow(r).map(escape).join(',')),
              ].join('\n');
              csvLabel = 'jasmine-export';
            }
          }
        }

        answer = composeToolAnswer(answer, observations);
        const occupancyRows = occupancyExportRows(observations);
        if (occupancyRows !== null) { csvData = toCSV(occupancyRows); csvLabel = 'jasmine-units'; }
        messages[messages.length - 1] = { role: 'assistant', content: answer };
        return Response.json({ answer, history: messages, csv_data: csvData, csv_label: csvLabel });
      }

      if (response.stop_reason === 'tool_use') {
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const block of response.content) {
          if (block.type !== 'tool_use') continue;

          try {
            const rawInput = block.input as Record<string, unknown>;
            const resolvedInput =
              block.name === 'get_move_schedule'
                ? resolveRelativeMoveScheduleInput(rawInput, query)
                : rawInput;
            const result = await executeTool(block.name, resolvedInput, accessToken);

            observations.push({ id: block.id, name: block.name, input: resolvedInput, result });
            // If this tool returns a list, capture it for CSV
            if (LIST_TOOLS.has(block.name) && Array.isArray(result) && result.length > 0) {
              csvData = toCSV(result as Record<string, unknown>[]);
              csvLabel = `jasmine-${block.name.replace('get_', '').replace(/_/g, '-')}`;
            }

            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: JSON.stringify(result),
            });
          } catch (err) {
            observations.push({ id: block.id, name: block.name, input: block.input as Record<string, unknown>, failed: true });
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: JSON.stringify({ error: String(err) }),
              is_error: true,
            });
          }
        }

        messages.push({ role: 'user', content: toolResults });
        rounds++;
        continue;
      }

      const fallback = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('');
      const answer = composeToolAnswer(fallback || 'Jasmine was unable to complete the request.', observations);
      const occupancyRows = occupancyExportRows(observations);
      if (occupancyRows !== null) { csvData = toCSV(occupancyRows); csvLabel = 'jasmine-units'; }
      messages[messages.length - 1] = { role: 'assistant', content: answer };
      return Response.json({
        answer,
        history: messages,
        csv_data: csvData,
        csv_label: csvLabel,
      });
    }

    const occupancyRows = occupancyExportRows(observations);
    if (occupancyRows !== null) {
      const answer = composeToolAnswer('', observations) +
        '\n\nThe tool limit was reached. Results above are preserved; further requested analysis may be incomplete.';
      messages.push({ role: 'assistant', content: answer });
      return Response.json({ answer, history: messages, csv_data: toCSV(occupancyRows), csv_label: 'jasmine-units' });
    }
    return Response.json(
      { error: 'Max tool rounds reached without a final answer.' },
      { status: 500 }
    );
  } catch (err) {
    console.error('[Jasmine API] Error:', err);
    return Response.json({ error: 'Internal server error. Please try again.' }, { status: 500 });
  }
}
