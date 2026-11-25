import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase ADMIN (service role).
 *
 * ⚠️ Fichier strictement serveur : ne jamais l'importer depuis un composant
 * client. La clé service role contourne les policies RLS et ne doit jamais
 * être exposée au navigateur.
 */
let cachedAdmin: SupabaseClient | null | undefined;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (cachedAdmin !== undefined) return cachedAdmin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    cachedAdmin = null;
    return cachedAdmin;
  }

  cachedAdmin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return cachedAdmin;
}

export function isSupabaseAdminConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}
