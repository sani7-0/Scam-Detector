'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppPage } from '@/components/scam-detector'
import { createClient } from '@/lib/supabase/client'
import { getUserRole } from '@/lib/profile'

export default function AdminLoginPage(){
  const router=useRouter()
  const [error,setError]=useState('')
  const [loading,setLoading]=useState(false)

  const submit=async(e:React.FormEvent<HTMLFormElement>)=>{
    e.preventDefault()
    setLoading(true)
    setError('')
    const form=new FormData(e.currentTarget)
    const email=String(form.get('email'))
    const password=String(form.get('password'))

    const supabase=createClient()
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if(authError || !data.user){
      setError('Admin access was not recognized. Use an admin account.')
      setLoading(false)
      return
    }

    const role = await getUserRole(data.user.id)

    if(role!=='admin'){
      await supabase.auth.signOut()
      setError('Admin access was not recognized. Use an admin account.')
      setLoading(false)
      return
    }

    router.push('/admin')
    router.refresh()
  }

  return <AppPage title="Admin access">
    <form className="auth-card" onSubmit={submit}>
      <p>Private operations console. This entry point is intentionally unlisted.</p>
      <label>Email address</label>
      <input name="email" required type="email" placeholder="admin@yourdomain.com"/>
      <label>Password</label>
      <input name="password" required minLength={8} type="password" placeholder="8 characters minimum"/>
      <button className="primary-button full" disabled={loading}>{loading?'Checking...':'Open console'}</button>
      {error&&<p className="form-error">{error}</p>}
    </form>
  </AppPage>
}