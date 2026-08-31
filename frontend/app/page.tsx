'use client';
import { useState } from 'react';
import { checkInput, checkImage } from '@/lib/api';

export default function Home() {
  const [input, setInput] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleCheck() {
    setError('');
    setResult(null);
    if (!input.trim() && !file) {
      setError('Paste a link or message, or choose an image.');
      return;
    }
    setLoading(true);
    try {
      const res = file ? await checkImage(file) : await checkInput(input);
      setResult(res);
    } catch {
      setError('Something went wrong reaching the server. Try again in a moment.');
    }
    setLoading(false);
  }

  return (
    <main style={{ padding: 24, maxWidth: 600, margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h1>Scam & Phishing Detector</h1>
      <p>Paste a link or a message, or upload a screenshot.</p>

      <textarea
        value={input}
        onChange={e => { setInput(e.target.value); setFile(null); }}
        placeholder="Paste a URL or a suspicious message..."
        rows={5}
        style={{ width: '100%', marginBottom: 8 }}
      />
      <input
        type="file"
        accept="image/*"
        onChange={e => { setFile(e.target.files?.[0] ?? null); setInput(''); }}
        style={{ marginBottom: 8 }}
      />
      <br />
      <button onClick={handleCheck} disabled={loading}>{loading ? 'Checking...' : 'Check'}</button>

      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      {result && (
        <div style={{ marginTop: 16, padding: 16, border: '1px solid #ccc', borderRadius: 8 }}>
          <h2>{result.verdict?.toUpperCase()} — {Math.round((result.risk_score ?? 0) * 100)}% risk</h2>
          {result.category && <p>Category: {result.category}</p>}
          {result.reasons?.map((r: string, i: number) => <p key={i}>• {r}</p>)}
          {(result.source === 'mock' || String(result.source).startsWith('mock')) && (
            <p style={{ fontStyle: 'italic', color: '#888' }}>Note: ML model not trained yet — this is a placeholder result.</p>
          )}
        </div>
      )}
    </main>
  );
}