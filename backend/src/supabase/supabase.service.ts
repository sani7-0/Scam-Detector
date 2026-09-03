import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import ws from 'ws';

@Injectable()
export class SupabaseService {
  private client: SupabaseClient;

  constructor(private config: ConfigService) {
    this.client = createClient(
      this.config.getOrThrow<string>('SUPABASE_URL'),
      this.config.getOrThrow<string>('SUPABASE_SERVICE_KEY'),
      { realtime: { transport: ws as any } },
    );
  }

  async getCached(hash: string) {
    const { data, error } = await this.client
      .from('cache')
      .select('result_json')
      .eq('input_hash', hash)
      .gt('created_at', new Date(Date.now() - 3600_000).toISOString())
      .maybeSingle();
    if (error) console.error('cache read error', error);
    return data?.result_json ?? null;
  }

  async setCache(hash: string, result: object) {
    const { error } = await this.client.from('cache').upsert({ input_hash: hash, result_json: result });
    if (error) console.error('cache write error', error);
  }

  async isAllowlisted(domain: string) {
    const { data } = await this.client
      .from('allowlist_domains')
      .select('domain')
      .eq('domain', domain)
      .maybeSingle();
    return !!data;
  }

  async logResult(hash: string, type: string, result: any, userId?: string | null, content?: string | null) {
  const { error } = await this.client.from('results').insert({
    input_hash: hash,
    input_type: type,
    risk_score: result.risk_score,
    verdict: result.verdict,
    category: result.category ?? null,
    confidence: result.confidence ?? null,
    model_source: result.source ?? null,
    user_id: userId ?? null,
    content: content ?? null,
  });
  if (error) console.error('log write error', error);
}
  async getStats() {
    const { data, error } = await this.client.from('results').select('category').eq('verdict', 'scam');
      if (error) { console.error('stats query error', error); return []; }
      const counts: Record<string, number> = {};
      for (const row of data) {
      const cat = row.category ?? 'uncategorized';
      counts[cat] = (counts[cat] ?? 0) + 1;
  }
  return Object.entries(counts).map(([category, flagged_count]) => ({ category, flagged_count }));
}
  async getUserFromToken(token: string) {
  const { data, error } = await this.client.auth.getUser(token);
  if (error || !data?.user) return null;
  return { id: data.user.id, email: data.user.email };
}

async getUserRole(userId: string): Promise<string> {
  const { data } = await this.client.from('profiles').select('role').eq('id', userId).maybeSingle();
  if (data) return data.role;
  await this.client.from('profiles').insert({ id: userId, role: 'user' }); // first time seeing this user
  return 'user';
}

async getAdminStats() {
  const { data, error } = await this.client.from('results').select('verdict, category');
  if (error) { console.error('admin stats error', error); return null; }
  const total = data.length;
  const scams = data.filter((r) => r.verdict === 'scam').length;
  const byCategory: Record<string, number> = {};
  for (const row of data) {
    if (row.verdict === 'scam') {
      const cat = row.category ?? 'uncategorized';
      byCategory[cat] = (byCategory[cat] ?? 0) + 1;
    }
  }
  return { total_checked: total, total_scams: scams, scam_rate: total ? +(scams / total).toFixed(3) : 0, by_category: byCategory };
}

async getRecentScams(limit = 50) {
  const { data, error } = await this.client
    .from('results')
    .select('id, input_type, category, content, confidence, created_at')
    .eq('verdict', 'scam')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) { console.error('recent scams query error', error); return []; }
  return data;
}

async getUserStats(userId: string) {
  const { data, error } = await this.client
    .from('results')
    .select('verdict, category, input_type, content, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) { console.error('user stats error', error); return null; }
  const total = data.length;
  const scams = data.filter((r) => r.verdict === 'scam').length;
  return { total_checked: total, total_scams: scams, scam_rate: total ? +(scams / total).toFixed(3) : 0, recent: data.slice(0, 20) };
}
}