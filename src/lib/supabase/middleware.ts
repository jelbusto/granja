import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

export async function updateSession(request: NextRequest): Promise<{
  supabaseResponse: NextResponse;
  user: { id: string; email?: string } | null;
}> {
  // Respuesta base — MUST ser creada antes del cliente para que setAll pueda actualizarla
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Paso 1: escribir en la request para que el cliente los vea
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          // Paso 2: recrear la respuesta con la request actualizada
          supabaseResponse = NextResponse.next({ request });
          // Paso 3: escribir en la respuesta para que el browser los reciba
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() refresca el token de sesión si ha expirado.
  // IMPORTANTE: no usar getSession() aquí — no valida el JWT contra el servidor.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabaseResponse, user };
}
