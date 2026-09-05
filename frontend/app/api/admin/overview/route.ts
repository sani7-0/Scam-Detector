import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const cookieStore = await import('next/headers').then(({ cookies }) => cookies())
  const sessionClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  )
  const { data: { user } } = await sessionClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  // Your profiles table only has (id, role, created_at) — no is_admin/status
  // columns. Gate on role === 'admin' instead.
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // `results` is the real table (not `scam_checks`). It has a `content`
  // column, but your CheckController's logResult(h, type, result, userId)
  // calls only ever pass the hash — never the actual url/text — so
  // `content` will read as null/empty for every existing row until the
  // backend is changed to also write it.
  //
  // `detector_rules` still doesn't exist in your schema. The query below
  // will just come back empty (not an error) until you create that table,
  // so the Rules tab will honestly show "no rules" rather than break.
  const [{ data: checks }, { data: users }, { data: rules }] = await Promise.all([
    admin.from('results').select('id,input_type,content,verdict,risk_score,confidence,category,model_source,created_at,user_id').order('created_at', { ascending: false }).limit(500),
    admin.from('profiles').select('id,role,created_at').order('created_at', { ascending: false }).limit(500),
    admin.from('detector_rules').select('id,name,rule_type,pattern,enabled,updated_at').order('updated_at', { ascending: false }),
  ])

  const rows = checks ?? []
  const highRisk = rows.filter((row) => row.risk_score >= 70).length
  const verdicts = rows.reduce<Record<string, number>>((acc, row) => { acc[row.verdict] = (acc[row.verdict] ?? 0) + 1; return acc }, {})

  return NextResponse.json({
    checks: rows,
    users: users ?? [],
    rules: rules ?? [],
    metrics: {
      totalChecks: rows.length,
      highRisk,
      activeUsers: (users ?? []).length,
      averageConfidence: rows.length ? Math.round(rows.reduce((sum, row) => sum + row.confidence, 0) / rows.length) : 0,
      verdicts,
    },
  })
}