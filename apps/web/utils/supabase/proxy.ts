import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicConfig } from "@/utils/supabase/keys";

/**
 * Mirrors isDevDataAccessEnabled() without pulling the admin client into the
 * proxy bundle. When dev data access is active there is no auth session to
 * gate on — every route stays open and reads resolve the dev owner instead.
 */
function isDevModeRequested(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.PLANEVO_DEV_MODE === "1" &&
    Boolean(process.env.PLANEVO_DEV_OWNER_ID)
  );
}

function isPublicPath(pathname: string): boolean {
  return pathname === "/login" || pathname.startsWith("/auth");
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const { url, key } = getSupabasePublicConfig();

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([headerKey, value]) =>
          supabaseResponse.headers.set(headerKey, value),
        );
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const hasUser = Boolean(data?.claims);

  if (isDevModeRequested()) {
    return supabaseResponse;
  }

  const { pathname } = request.nextUrl;

  if (!hasUser && !isPublicPath(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = "";
    const redirectResponse = NextResponse.redirect(redirectUrl);
    supabaseResponse.cookies.getAll().forEach((cookie) =>
      redirectResponse.cookies.set(cookie),
    );
    return redirectResponse;
  }

  if (hasUser && pathname === "/login") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    redirectUrl.search = "";
    const redirectResponse = NextResponse.redirect(redirectUrl);
    supabaseResponse.cookies.getAll().forEach((cookie) =>
      redirectResponse.cookies.set(cookie),
    );
    return redirectResponse;
  }

  return supabaseResponse;
}
