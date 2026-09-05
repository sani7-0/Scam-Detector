import { createClient } from '@/lib/supabase/client'

/**
 * Real API layer for the NestJS backend (replaces lib/mock-api.ts for network calls).
 *
 * Endpoints wired up (from CheckController):
 *   POST /check/url         { url }        -> PredictionResult
 *   POST /check/text        { text }       -> PredictionResult
 *   POST /check/image       multipart file -> PredictionResult
 *   POST /check/image-url   { imageUrl }   -> PredictionResult
 *   POST /check             { input }      -> PredictionResult (auto-detect url/text)
 *   GET  /check/stats                      -> shape TBD, see StatsResponse below
 *
 * Set NEXT_PUBLIC_API_URL in your env (see .env.local.example) to your backend's
 * base URL, e.g. https://your-backend.onrender.com
 */

export type Verdict = 'safe' | 'suspicious' | 'scam'

// This mirrors the backend's PredictionResult (ml-predictor.interface.ts).
// NOTE: the backend does NOT currently return `summary` or per-check `reasons` —
// only risk_score / verdict / category / confidence / source. The UI previously
// showed fabricated summary + reasons copy from the mock; see toDisplayResult()
// below for how those are now derived honestly instead of invented.
export type PredictionResult = {
  risk_score: number
  verdict: Verdict
  category: string | null
  confidence: number
  source?: string
}

export type DisplayResult = PredictionResult & {
  summary: string
  reasons: string[]
}

// Shape of GET /check/stats is not confirmed (db.getStats() implementation
// wasn't available when this was written). Adjust this type + the mapping in
// AdminConsole once you confirm the real fields.
export type StatsResponse = {
  total?: number
  byCategory?: Record<string, number>
  byVerdict?: Record<string, number>
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? ''

if (!API_BASE_URL && typeof window !== 'undefined') {
  // eslint-disable-next-line no-console
  console.warn(
    '[api] NEXT_PUBLIC_API_URL is not set — requests to the backend will fail. See .env.local.example.',
  )
}

async function authHeaders(): Promise<Record<string, string>> {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const auth = await authHeaders()
  const isFormData = init.body instanceof FormData

  const res = await fetch(`${API_BASE_URL}/v1${path}`, {
    ...init,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...auth,
      ...(init.headers as Record<string, string> | undefined),
    },
  })

  if (!res.ok) {
    const bodyText = await res.text().catch(() => '')
    let message = bodyText || res.statusText
    try {
      const parsed = JSON.parse(bodyText)
      if (Array.isArray(parsed?.message)) {
        message = parsed.message.join(', ')
      } else if (typeof parsed?.message === 'string') {
        message = parsed.message
      } else if (parsed?.error) {
        message = typeof parsed.error === 'string' ? parsed.error : JSON.stringify(parsed.error)
      }
    } catch {
      // response wasn't JSON, keep raw text
    }
    throw new ApiError(message, res.status)
  }

  return res.json() as Promise<T>
}

/**
 * The frontend does strict checks like `verdict === 'safe'` to decide colors
 * (green vs red). If the backend ever sends "Safe", "SAFE", " safe ", etc.
 * instead of exactly "safe", those checks silently fail and everything
 * renders as the danger/red state — which matches the bug you're seeing.
 * Normalizing here, once, means every caller downstream can keep doing
 * simple string comparisons safely.
 */
function normalizeResult(raw: PredictionResult): PredictionResult {
  const toPercent = (n: number) => (n > 0 && n <= 1 ? n * 100 : n)
  return {
    ...raw,
    verdict: String(raw.verdict).trim().toLowerCase() as Verdict,
    confidence: toPercent(raw.confidence),
    risk_score: toPercent(raw.risk_score),
  }
}

export async function checkUrl(url: string) {
  const raw = await request<PredictionResult>('/check/url', {
    method: 'POST',
    body: JSON.stringify({ url }),
  })
  return normalizeResult(raw)
}

export async function checkText(text: string) {
  const raw = await request<PredictionResult>('/check/text', {
    method: 'POST',
    body: JSON.stringify({ text }),
  })
  return normalizeResult(raw)
}

export async function checkImage(file: File) {
  const form = new FormData()
  form.append('file', file)
  const raw = await request<PredictionResult>('/check/image', {
    method: 'POST',
    body: form,
  })
  return normalizeResult(raw)
}

export async function checkImageUrl(imageUrl: string) {
  const raw = await request<PredictionResult>('/check/image-url', {
    method: 'POST',
    body: JSON.stringify({ imageUrl }),
  })
  return normalizeResult(raw)
}

export async function checkAuto(input: string) {
  const raw = await request<PredictionResult>('/check', {
    method: 'POST',
    body: JSON.stringify({ input }),
  })
  return normalizeResult(raw)
}

export function getStats() {
  return request<StatsResponse>('/check/stats', { method: 'GET' })
}

/**
 * The mock API used to return `summary` and `reasons` describing *why* a
 * result was flagged, but the real backend doesn't send that back yet.
 * Rather than inventing plausible-sounding reasons, this derives only what
 * the real response actually supports: a generic message tied to the real
 * verdict/confidence, and the real `category` if one came back.
 */
export function toDisplayResult(result: PredictionResult): DisplayResult {
  const summary =
    result.verdict === 'safe'
      ? 'No major warning signs were found in this sample.'
      : result.verdict === 'suspicious'
        ? 'This sample shows some signals that are worth a closer look.'
        : 'This sample matches patterns commonly seen in scams.'

  const reasons = result.category ? [`Flagged category: ${result.category}`] : []

  return { ...result, summary, reasons }
}

export function verdictLabel(verdict: Verdict): string {
  switch (verdict) {
    case 'safe':
      return 'Looks safe'
    case 'suspicious':
      return 'Needs a closer look'
    case 'scam':
      return 'Likely a scam'
  }
}