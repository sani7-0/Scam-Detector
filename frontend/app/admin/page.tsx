'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AdminPage } from '@/components/scam-detector'
export default function AdminRoute(){const router=useRouter();useEffect(()=>{const session=sessionStorage.getItem('mock-session');if(!session)router.replace('/admin-login')},[router]);return <AdminPage/>}
