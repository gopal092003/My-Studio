import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_PRIMARY_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PRIMARY_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const tracksArtwork = /^\/art\/[0-9a-f-]{36}$/i.test(request.nextUrl.pathname);
  const visitorCookie = "artwork-visitor-id";
  const existingVisitorId = request.cookies.get(visitorCookie)?.value;
  const newVisitorId = tracksArtwork && !existingVisitorId ? crypto.randomUUID() : undefined;

  if (newVisitorId) request.cookies.set(visitorCookie, newVisitorId);

  let response = NextResponse.next({ request });

  if (url && publishableKey) {
    const supabase = createServerClient<Database>(url, publishableKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
          Object.entries(headers).forEach(([name, value]) => {
            response.headers.set(name, value);
          });
        },
      },
    });

    await supabase.auth.getClaims();
  }

  if (newVisitorId) {
    response.cookies.set(visitorCookie, newVisitorId, {
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
