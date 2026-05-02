import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Verify caller's JWT and return their user id.
 * Returns null if unauthenticated/invalid.
 */
export async function getAuthedUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  try {
    const token = authHeader.replace("Bearer ", "");
    const { data, error } = await (client.auth as any).getClaims(token);
    if (error || !data?.claims?.sub) return null;
    return data.claims.sub as string;
  } catch {
    try {
      const { data, error } = await client.auth.getUser();
      if (error || !data?.user?.id) return null;
      return data.user.id;
    } catch {
      return null;
    }
  }
}