'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AdminDashboard } from '@/components/dashboard-shell'

export default function AdminRoute() {
  const router = useRouter()
  useEffect(() => {
    const session = sessionStorage.getItem('mock-session')
    if (!session || JSON.parse(session).role !== 'admin') router.replace('/admin-login')
  }, [router])
  return <AdminDashboard />
}
