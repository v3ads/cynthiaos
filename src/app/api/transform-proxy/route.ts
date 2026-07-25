import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const TRANSFORM_BASE =
  process.env.TRANSFORM_WORKER_URL ||
  'https://cynthiaos-transform-worker-production.up.railway.app';

// The transform worker holds the full Gold-layer integrity report — record
// counts, reconciliation details, and portfolio income totals. This relay was
// previously open: any unauthenticated request to
// /api/transform-proxy?_path=/validation/integrity returned the whole report.
// It is now an authenticated, allowlisted relay, matching /api/proxy.
const ALLOWED_PATHS = ['/validation/integrity', '/validation/logs', '/strategies', '/health'];

async function getSessionToken(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesToSet: { name: string; value: string; options?: unknown }[]) => {
            // Read-only in this route handler — the session is only being read.
            void cookiesToSet;
          },
        },
      }
    );
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const path = searchParams.get('_path');

  if (!path) {
    return NextResponse.json({ error: 'Missing _path parameter' }, { status: 400 });
  }

  // Deny-by-default: only known worker paths may be reached.
  if (!ALLOWED_PATHS.includes(path)) {
    return NextResponse.json({ error: 'Path not allowed' }, { status: 403 });
  }

  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const forwardParams = new URLSearchParams();
  searchParams.forEach((value, key) => {
    if (key !== '_path') forwardParams.set(key, value);
  });

  const queryString = forwardParams.toString();
  const targetUrl = `${TRANSFORM_BASE}${path}${queryString ? `?${queryString}` : ''}`;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  // Service-to-service credential for the worker's own auth boundary. Stays
  // server-side — it is never sent to the browser.
  const workerSecret = process.env.WORKER_SHARED_SECRET;
  if (workerSecret) headers['X-Worker-Key'] = workerSecret;

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers,
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
