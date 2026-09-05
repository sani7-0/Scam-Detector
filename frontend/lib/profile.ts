import { createClient } from '@/lib/supabase/client'

/**
 * Role lives in the `profiles` table (id uuid references auth.users, role text),
 * not in Supabase auth metadata. Looks up the role for the given user id.
 *
 * IMPORTANT: `profiles` currently has RLS disabled in your Supabase project.
 * That means any signed-in client can read (and likely write) every row in
 * this table via the anon key, including flipping their own `role` to
 * 'admin' from the browser console. Enable RLS with a policy that at minimum
 * lets a user read only their own row, and never allow a client-side update
 * to the `role` column — that should only be settable from a trusted
 * server/service-role context.
 */
export async function getUserRole(userId: string): Promise<string | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  if (error || !data) return null
  return data.role as string
}