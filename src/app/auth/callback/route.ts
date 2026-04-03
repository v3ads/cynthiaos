import { createClient } from '../../../lib/supabase/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ALLOWED_EMAILS = ['leasing@cynthiagardens.com', 'vipaymanshalaby@gmail.com'];

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Check if the authenticated user's email is in the whitelist
      const { data: { user } } = await supabase.auth.getUser();
      const email = user?.email ?? '';

      if (!ALLOWED_EMAILS.includes(email)) {
        // Sign out the unauthorized user immediately
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/login?error=unauthorized`);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
