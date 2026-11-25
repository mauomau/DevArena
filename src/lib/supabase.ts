import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase PUBLIC (clé anon).
 *
 * Utilisé uniquement dans le navigateur pour écouter les changements de la
 * table `scores` en temps réel. Aucune écriture ne passe par ce client : la
 * policy RLS n'autorise que la lecture.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function hasSupabaseBrowserConfig(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

let browserClient: SupabaseClient | null = null;

/**
 * Retourne le client navigateur, ou `null` si les variables publiques ne sont
 * pas configurées. Le leaderboard bascule alors en mode sondage (`polling`).
 */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (!hasSupabaseBrowserConfig()) return null;
  if (!browserClient) {
    browserClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { params: { eventsPerSecond: 5 } },
    });
  }
  return browserClient;
}
