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

  async logResult(hash: string, type: string, result: any) {
    const { error } = await this.client.from('results').insert({
      input_hash: hash,
      input_type: type,
      risk_score: result.risk_score,
      verdict: result.verdict,
      category: result.category ?? null,
      model_source: result.model_source ?? null,
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
}