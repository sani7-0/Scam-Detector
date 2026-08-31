export interface PredictionResult {
  risk_score: number;   // 0.0 to 1.0
  verdict: 'safe' | 'suspicious' | 'scam' | 'pending';
  category: string | null;
  confidence: number;   // 0.0 to 1.0
  source: 'mock' | 'model' | 'allowlist' | 'cache' | 'error';
  message?: string;      // only set on 'pending'/'error', explains why
}

export interface MlPredictor {
  predictUrl(url: string): Promise<PredictionResult>;
  predictText(text: string): Promise<PredictionResult>;
  predictImage(form: FormData): Promise<PredictionResult>;
}