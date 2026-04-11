import { NextRequest, NextResponse } from 'next/server';

const TRANSFORM_BASE = 'https://cynthiaos-transform-worker-production.up.railway.app';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const path = searchParams.get('_path');

  if (!path) {
    return NextResponse.json({ error: 'Missing _path parameter' }, { status: 400 });
  }

  const forwardParams = new URLSearchParams();
  searchParams.forEach((value, key) => {
    if (key !== '_path') forwardParams.set(key, value);
  });

  const queryString = forwardParams.toString();
  const targetUrl = `${TRANSFORM_BASE}${path}${queryString ? `?${queryString}` : ''}`;

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { error: 'Transform proxy fetch failed', details: String(error) },
      { status: 502 }
    );
  }
}
