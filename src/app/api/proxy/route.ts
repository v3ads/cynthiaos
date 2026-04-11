import { NextRequest, NextResponse } from 'next/server';

const FALLBACK_API_BASE = 'https://cynthiaos-api-production.up.railway.app';

export async function GET(request: NextRequest) {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || FALLBACK_API_BASE;

  // Extract the target path and query string from the proxy request
  const { searchParams } = request.nextUrl;
  const path = searchParams.get('_path');

  if (!path) {
    return NextResponse.json({ error: 'Missing _path parameter' }, { status: 400 });
  }

  // Rebuild query params, excluding the internal _path key
  const forwardParams = new URLSearchParams();
  searchParams.forEach((value, key) => {
    if (key !== '_path') {
      forwardParams.set(key, value);
    }
  });

  const queryString = forwardParams.toString();
  const targetUrl = `${API_BASE}${path}${queryString ? `?${queryString}` : ''}`;


  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    const data = await response.json();

  
    // Log first 3 records to confirm data shape without flooding logs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sample = Array.isArray(data) ? data.slice(0, 3) : (Array.isArray((data as any)?.data) ? (data as any).data.slice(0, 3) : data);

    if (!response.ok) {
      console.error('[CynthiaOS Proxy] Upstream error:', {
        targetUrl,
        status: response.status,
        statusText: response.statusText,
      });
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[CynthiaOS Proxy] fetch() failed:', {
      targetUrl,
      error,
    });
    return NextResponse.json({ error: 'Proxy fetch failed', details: String(error) }, { status: 502 });
  }
}
