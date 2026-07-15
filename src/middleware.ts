import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Deny-by-default: every route requires an authenticated session EXCEPT these
// public paths. New pages are protected automatically — the allowlist approach
// (which silently exposed the Release 2-4 routes) is gone for good.
const PUBLIC_PATHS = ['/login', '/auth/callback', '/auth/confirm'];

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;

  // Never redirect API routes — they handle their own auth
  if (pathname.startsWith('/api/')) return supabaseResponse;

  const isPublic =
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/')) ||
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico';

  // Deny-by-default: anything not explicitly public requires a session.
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user && (pathname === '/login' || pathname === '/')) {
    // Today is the landing route (Release 2). Authenticated users hitting
    // /login or the bare root go straight there.
    const url = request.nextUrl.clone();
    url.pathname = '/today';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|auth/callback|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
