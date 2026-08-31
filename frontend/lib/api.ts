const API = process.env.NEXT_PUBLIC_API_URL;

export async function checkInput(input: string) {
  return fetch(`${API}/check`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input }),
  }).then(r => r.json());
}

export async function checkImage(file: File) {
  const form = new FormData();
  form.append('file', file);
  return fetch(`${API}/check`, { method: 'POST', body: form }).then(r => r.json());
}