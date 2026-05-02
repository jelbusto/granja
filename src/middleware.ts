import createMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { routing } from "@/lib/i18n/routing";
import { updateSession } from "@/lib/supabase/middleware";

const intlMiddleware = createMiddleware(routing);

// Rutas públicas (no requieren sesión)
const PUBLIC_PATHS = ["/auth", "/"];

// Rutas de autenticación (redirigen al dashboard si ya está autenticado)
const AUTH_PATHS = ["/auth"];

function extractLocaleAndPath(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const locales = routing.locales as readonly string[];
  const locale = locales.includes(segments[0]) ? segments[0] : routing.defaultLocale;
  const pathWithoutLocale = locales.includes(segments[0])
    ? "/" + segments.slice(1).join("/")
    : pathname;
  return { locale, pathWithoutLocale };
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Refrescar sesión de Supabase y obtener usuario
  const { supabaseResponse, user } = await updateSession(request);

  const { locale, pathWithoutLocale } = extractLocaleAndPath(pathname);

  const isPublic = PUBLIC_PATHS.some((p) =>
    pathWithoutLocale === p || pathWithoutLocale.startsWith(p + "/")
  );
  const isAuthPath = AUTH_PATHS.some((p) =>
    pathWithoutLocale === p || pathWithoutLocale.startsWith(p + "/")
  );

  // 2. Redirigir a /auth si intenta acceder a ruta protegida sin sesión
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/auth`;
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // 3. Redirigir al dashboard si ya está autenticado e intenta ir a /auth
  if (user && isAuthPath) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/dashboard`;
    return NextResponse.redirect(url);
  }

  // 4. Ejecutar middleware de next-intl (gestiona locale y prefijo de URL)
  const intlResponse = intlMiddleware(request);

  // 5. Propagar las cookies de sesión de Supabase a la respuesta de next-intl
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    intlResponse.cookies.set(cookie.name, cookie.value, cookie);
  });

  return intlResponse;
}

export const config = {
  matcher: [
    /*
     * Excluir archivos estáticos y rutas internas de Next.js.
     * Incluir todo lo demás (páginas, API routes, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
