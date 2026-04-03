import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ALLOWED_EMAILS = ['leasing@cynthiagardens.com', 'vipaymanshalaby@gmail.com'];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  // Build the correct redirect base URL from headers
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '';
  const proto = request.headers.get('x-forwarded-proto') ?? 'https';
  const redirectBase = `${proto}://${host}`;

  if (!code) {
    return NextResponse.redirect(`${redirectBase}/login?error=auth_failed`);
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('[auth/callback] exchangeCodeForSession error:', error.message);
    return NextResponse.redirect(`${redirectBase}/login?error=auth_failed`);
  }

  const { data: { user } } = await supabase.auth.getUser();
  const email = (user?.email ?? '').toLowerCase().trim();

  if (!ALLOWED_EMAILS.map(e => e.toLowerCase()).includes(email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${redirectBase}/login?error=unauthorized`);
  }

  return NextResponse.redirect(`${redirectBase}${next}`);
}
