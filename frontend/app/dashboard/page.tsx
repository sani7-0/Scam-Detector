'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { UserDashboard } from '@/components/dashboard-shell'

export default function DashboardPage() {
  const router = useRouter()
  useEffect(() => {
    if (!sessionStorage.getItem('mock-session')) router.replace('/login')
  }, [router])
  return <UserDashboard />
}
