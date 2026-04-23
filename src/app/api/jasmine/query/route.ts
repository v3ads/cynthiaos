import Anthropic from '@anthropic-ai/sdk';
import { JASMINE_TOOLS } from '@/lib/jasmine/tools';
import { executeTool } from '@/lib/jasmine/executor';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are Jasmine, the AI property management assistant for Cynthia Gardens, a 182-unit residential rental community in operation.

Your primary users are:
- Ayman: owner and operations lead. Wants concise numbers and financial insight.
- Cindy: property manager. Wants actionable detail on units, tenants, and tasks.
- Leasing team: wants vacancy, availability, and prospect-ready information.

You have access to live data from the CynthiaOS Gold layer via tools.
Always call the most relevant tool before answering — never guess at numbers.
If a question requires more than one tool, call all of them before responding.

RESPONSE STYLE:
- Lead with the key number or direct answer on the first line.
- Use markdown formatting to make responses readable:
  - Use **bold** for key numbers, unit IDs, tenant names, and totals.
  - Use bullet lists (- item) for any list of 3 or more items.
  - Use ### for section headers when a response has multiple sections.
  - Use a markdown table when comparing multiple units or tenants side by side.
- Format rent amounts with $ and commas e.g. $1,850.
- Format dates as Month DD, YYYY e.g. July 31, 2026.
- Keep answers tight. Ayman and Cindy are reading on mobile.
- If data is empty (e.g. no move-ins this month), say so directly.

BUSINESS RULES YOU MUST KNOW:
- Family units 115, 116, 202, 313, 318 are always treated as occupied and excluded from vacancy counts and revenue totals.
- Employee units 411, 707, 905, 906 are always treated as occupied and excluded from vacancy and revenue calculations.
- The Gold layer data is refreshed daily at 6 AM EST by the CynthiaOS pipeline. If asked when data was last updated, use the get_portfolio_summary tool and read the last_pipeline_run field.
- Student units have a dash in the unit number e.g. 114-A.
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
  const escape  = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    headers.join(','),
    ...rows.map(r => headers.map(h => escape(r[h])).join(','))
  ].join('\n');
}

const MAX_ROUNDS = 5;

export async function POST(req: Request) {
  try {
    const { query, history = [] } = await req.json();

    if (!query || typeof query !== 'string') {
      return Response.json({ error: 'query is required' }, { status: 400 });
    }

    const messages: Anthropic.MessageParam[] = [
      ...history,
      { role: 'user', content: query },
    ];

    let rounds   = 0;
    let csvData: string | null = null;
    let csvLabel = 'jasmine-export';

    while (rounds < MAX_ROUNDS) {
      const response = await anthropic.messages.create({
        model:      'claude-sonnet-4-5',
        max_tokens: 2048,
        system:     SYSTEM_PROMPT,
        tools:      JASMINE_TOOLS,
        messages,
      });

      messages.push({ role: 'assistant', content: response.content });

      if (response.stop_reason === 'end_turn') {
        const answer = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('');
        return Response.json({ answer, history: messages, csv_data: csvData, csv_label: csvLabel });
      }

      if (response.stop_reason === 'tool_use') {
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const block of response.content) {
          if (block.type !== 'tool_use') continue;

          try {
            const result = await executeTool(block.name, block.input as Record<string, unknown>);

            // If this tool returns a list, capture it for CSV
            if (LIST_TOOLS.has(block.name) && Array.isArray(result) && result.length > 0) {
              csvData  = toCSV(result as Record<string, unknown>[]);
              csvLabel = `jasmine-${block.name.replace('get_', '').replace(/_/g, '-')}`;
            }

            toolResults.push({
              type:        'tool_result',
              tool_use_id: block.id,
              content:     JSON.stringify(result),
            });
          } catch (err) {
            toolResults.push({
              type:        'tool_result',
              tool_use_id: block.id,
              content:     JSON.stringify({ error: String(err) }),
              is_error:    true,
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
      return Response.json({
        answer:    fallback || 'Jasmine was unable to complete the request.',
        history:   messages,
        csv_data:  csvData,
        csv_label: csvLabel,
      });
    }

    return Response.json({ error: 'Max tool rounds reached without a final answer.' }, { status: 500 });
  } catch (err) {
    console.error('[Jasmine API] Error:', err);
    return Response.json({ error: 'Internal server error. Please try again.' }, { status: 500 });
  }
}
