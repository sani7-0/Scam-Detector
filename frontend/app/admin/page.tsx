'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getUserRole } from '@/lib/profile'
import { AdminConsole } from '@/components/admin-console'

/**
 * IMPORTANT: this only gates the UI on the client. The backend's
 * `/check/stats` endpoint is not currently role-protected (it just sits
 * behind OptionalAuthGuard like everything else), so this page hiding
 * itself from non-admins is a UX nicety, not real access control — anyone
 * who knows the URL could still call the API directly. If this data is
 * sensitive, add real role enforcement server-side.
 *
 * Role comes from the `profiles` table (id, role). Make sure RLS is enabled
 * on that table so a signed-in user can't rewrite their own role client-side.
 */
export default function AdminRoute() {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.replace('/admin-login')
        return
      }

      const role = await getUserRole(data.user.id)
      if (role !== 'admin') {
        router.replace('/admin-login')
        return
      }

      setReady(true)
    })
  }, [router])

  if (!ready) return null
  return <AdminConsole />
}