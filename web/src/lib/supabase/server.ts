import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component içinden çağrıldığında cookie set edilemez —
            // middleware tarafı session'ı zaten tazeliyor, burada yutuyoruz.
          }
        },
      },
    },
  );
}

/**
 * RLS'i bypass eden service-role client. YALNIZCA sunucu tarafında, yazma
 * işlemleri için kullanılır (ör. ödeme webhook'u, subscriptions insert/update).
 * Asla istemciye veya NEXT_PUBLIC_ env'ine taşınmamalı.
 */
export function createServiceRoleClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
