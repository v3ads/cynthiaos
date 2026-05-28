import { NextResponse } from 'next/server';

const AITABLE_TOKEN = process.env.AITABLE_TOKEN;
const DATASHEET_ID  = 'dstYC1EY7nrSyCdAZc';
const BASE_URL      = `https://aitable.ai/fusion/v1/datasheets/${DATASHEET_ID}/records`;

interface AiTableRecord {
  recordId: string;
  fields: {
    Source?: string;
    Converted?: string;
    Name?: string;
    Date?: string;
    Unit?: string;
  };
}

export interface ConvertedLead {
  name: string;
  unit: string | null;
  date: string | null;
}

export interface PlatformStat {
  platform: string;
  leads: number;
  converted: number;
  conversion_rate: number;
  converted_leads: ConvertedLead[];
}

async function fetchAllRecords(): Promise<AiTableRecord[]> {
  const records: AiTableRecord[] = [];
  let pageNum = 1;
  const pageSize = 100;

  while (true) {
    const params = new URLSearchParams({
      pageSize: String(pageSize),
      pageNum:  String(pageNum),
    });
    params.append('fields[]', 'Source');
    params.append('fields[]', 'Converted');
    params.append('fields[]', 'Name');
    params.append('fields[]', 'Date');
    params.append('fields[]', 'Unit');

    const res = await fetch(`${BASE_URL}?${params}`, {
      headers: { Authorization: `Bearer ${AITABLE_TOKEN}` },
      cache: 'no-store',
    });

    if (!res.ok) {
      throw new Error(`AITable API error: ${res.status} ${res.statusText}`);
    }

    const json = await res.json();
    const data = json?.data;
    if (!data?.records?.length) break;

    records.push(...data.records);

    const total = data.total ?? 0;
    if (records.length >= total) break;
    pageNum++;
  }

  return records;
}

export async function GET() {
  try {
    const records = await fetchAllRecords();

    // Aggregate by platform
    const agg = new Map<string, { leads: number; converted: number; converted_leads: ConvertedLead[] }>();

    for (const rec of records) {
      const src  = (rec.fields?.Source ?? 'Unknown').trim();
      const conv = (rec.fields?.Converted ?? 'No').trim().toLowerCase();

      if (!agg.has(src)) agg.set(src, { leads: 0, converted: 0, converted_leads: [] });
      const entry = agg.get(src)!;
      entry.leads += 1;

      if (conv === 'yes') {
        entry.converted += 1;
        entry.converted_leads.push({
          name: (rec.fields?.Name ?? 'Unknown').trim(),
          unit: rec.fields?.Unit?.trim() || null,
          date: rec.fields?.Date?.trim() || null,
        });
      }
    }

    const platforms: PlatformStat[] = Array.from(agg.entries())
      .map(([platform, { leads, converted, converted_leads }]) => ({
        platform,
        leads,
        converted,
        conversion_rate: leads > 0 ? Math.round((converted / leads) * 1000) / 10 : 0,
        converted_leads,
      }))
      .sort((a, b) => b.leads - a.leads);

    const totals = platforms.reduce(
      (acc, p) => ({ leads: acc.leads + p.leads, converted: acc.converted + p.converted }),
      { leads: 0, converted: 0 }
    );

    return NextResponse.json({
      platforms,
      totals: {
        leads: totals.leads,
        converted: totals.converted,
        conversion_rate: totals.leads > 0
          ? Math.round((totals.converted / totals.leads) * 1000) / 10
          : 0,
      },
      fetched_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[platforms] AITable fetch error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch platform data', details: String(err) },
      { status: 502 }
    );
  }
}
