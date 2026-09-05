'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Verdict } from '@/lib/api'

/**
 * The backend logs every check to the database (`db.logResult`), but there is
 * currently no GET endpoint to read that history back for a signed-in user
 * (e.g. `GET /check/history`). Rather than fabricating fake rows like the old
 * mock UI did, this keeps a small, honest, per-browser log of checks actually
 * performed in this dashboard, persisted to localStorage.
 *
 * This is NOT the same as real per-account history — it won't follow the user
 * across devices/browsers, and clearing site data clears it. If/when a real
 * history endpoint exists on the backend, swap this out for a fetch call.
 */

export type HistoryEntry = {
  id: string
  target: string
  type: 'URL' | 'Message' | 'Screenshot'
  verdict: Verdict
  riskScore: number
  time: string // ISO timestamp
}

const STORAGE_KEY = 'scam-detector:check-history'
const MAX_ENTRIES = 50
const EVENT_NAME = 'scam-detector:check-history-updated'

function readHistory(): HistoryEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function addHistoryEntry(entry: Omit<HistoryEntry, 'id' | 'time'>) {
  if (typeof window === 'undefined') return
  const next: HistoryEntry = {
    ...entry,
    id: `chk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    time: new Date().toISOString(),
  }
  const updated = [next, ...readHistory()].slice(0, MAX_ENTRIES)
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  window.dispatchEvent(new Event(EVENT_NAME))
}

export function clearHistory() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(STORAGE_KEY)
  window.dispatchEvent(new Event(EVENT_NAME))
}

export function useCheckHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>([])

  useEffect(() => {
    setEntries(readHistory())
    const onUpdate = () => setEntries(readHistory())
    window.addEventListener(EVENT_NAME, onUpdate)
    window.addEventListener('storage', onUpdate)
    return () => {
      window.removeEventListener(EVENT_NAME, onUpdate)
      window.removeEventListener('storage', onUpdate)
    }
  }, [])

  const add = useCallback((entry: Omit<HistoryEntry, 'id' | 'time'>) => {
    addHistoryEntry(entry)
  }, [])

  return { entries, add, clear: clearHistory }
}

export function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.round(diffMs / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`
  const days = Math.round(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return new Date(iso).toLocaleDateString()
}

/** Buckets the last 7 days of local history into day-of-week check counts. */
export function weeklyActivity(entries: HistoryEntry[]) {
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const counts = new Array(7).fill(0)
  const now = new Date()
  const sevenDaysAgo = new Date(now)
  sevenDaysAgo.setDate(now.getDate() - 6)
  sevenDaysAgo.setHours(0, 0, 0, 0)

  for (const entry of entries) {
    const date = new Date(entry.time)
    if (date >= sevenDaysAgo) {
      counts[date.getDay()] += 1
    }
  }

  // Rotate so the array starts 6 days ago and ends today, in order.
  const startDay = sevenDaysAgo.getDay()
  const ordered = []
  for (let i = 0; i < 7; i++) {
    const idx = (startDay + i) % 7
    ordered.push({ day: dayLabels[idx], checks: counts[idx] })
  }
  return ordered
}

export function verdictSplit(entries: HistoryEntry[]) {
  const counts: Record<Verdict, number> = { safe: 0, suspicious: 0, scam: 0 }
  for (const entry of entries) counts[entry.verdict] += 1
  const total = entries.length
  if (total === 0) return []
  return [
    { name: 'Safe', value: Math.round((counts.safe / total) * 100), color: '#a9c7d8' },
    { name: 'Suspicious', value: Math.round((counts.suspicious / total) * 100), color: '#d3aa70' },
    { name: 'High risk', value: Math.round((counts.scam / total) * 100), color: '#c47c78' },
  ]
}