import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const FALLBACK_API_BASE = 'https://cynthiaos-api-production.up.railway.app';

// The proxy only relays to the CynthiaOS API surface — never an arbitrary path.
const ALLOWED_PATH_PREFIXES = ['/api/v1/', '/api/v2/', '/api/jasmine/', '/health'];

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
            // Read-only in this route handler — session is only being read,
            // not refreshed. Signature matches @supabase/ssr's contract so the
            // strict production build accepts it.
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

async function proxyRequest(request: NextRequest, method: string) {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || FALLBACK_API_BASE;

  const { searchParams } = request.nextUrl;
  const path = searchParams.get('_path');

  if (!path) {
    return NextResponse.json({ error: 'Missing _path parameter' }, { status: 400 });
  }

  // Deny-by-default: the proxy is an authenticated relay, not an open one.
  // Only known API prefixes may be reached, and only with a valid session.
  if (!ALLOWED_PATH_PREFIXES.some((p) => path.startsWith(p))) {
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
  const targetUrl = `${API_BASE}${path}${queryString ? `?${queryString}` : ''}`;

  try {
    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        // Forward the verified user's token so the backend can authenticate
        // the principal itself (the backend is the true boundary).
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    };
    if (method !== 'GET' && method !== 'HEAD') {
      const body = await request.text();
      if (body) fetchOptions.body = body;
    }
    const response = await fetch(targetUrl, fetchOptions);
    const data = await response.json();
    if (!response.ok) {
      console.error('[CynthiaOS Proxy] Upstream error:', { targetUrl, status: response.status });
      return NextResponse.json(data, { status: response.status });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error('[CynthiaOS Proxy] fetch() failed:', { targetUrl, error });
    return NextResponse.json(
      { error: 'Proxy fetch failed', details: String(error) },
      { status: 502 }
    );
  }
}

export async function POST(request: NextRequest) {
  return proxyRequest(request, 'POST');
}

export async function GET(request: NextRequest) {
  // GET goes through the same authenticated relay as every other method.
  // (It previously had its own inline passthrough with no auth check — the
  // hole that left reads open even after the proxy was "secured".)
  return proxyRequest(request, 'GET');
}

// PATCH/DELETE support for the Release 2 action layer (/api/v2/actions/:id).
// proxyRequest already forwards request bodies for non-GET methods.
export async function PATCH(request: NextRequest) {
  return proxyRequest(request, 'PATCH');
}

export async function DELETE(request: NextRequest) {
  return proxyRequest(request, 'DELETE');
}
