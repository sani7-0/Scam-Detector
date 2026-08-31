import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { MlPredictor, PredictionResult } from './ml-predictor.interface';

// TEMPORARY — remove or stop using once RealMlService is connected to trained models.
@Injectable()
export class MockMlService implements MlPredictor {
  private scoreFor(input: string): number {
    // deterministic, not random — same input always gives the same mock score,
    // so caching/logging/UI behave consistently while you test
    const hash = createHash('md5').update(input).digest('hex');
    return (parseInt(hash.slice(0, 8), 16) % 100) / 100;
  }

  private verdictFor(score: number): PredictionResult['verdict'] {
    if (score < 0.3) return 'safe';
    if (score < 0.7) return 'suspicious';
    return 'scam';
  }

  private mockResult(input: string, category: string): PredictionResult {
    const risk_score = this.scoreFor(input);
    return {
      risk_score,
      verdict: this.verdictFor(risk_score),
      category,
      confidence: 0.5, // meaningless placeholder until a real model exists
      source: 'mock',
    };
  }

  async predictUrl(url: string) { return this.mockResult(url, 'phishing'); }
  async predictText(text: string) { return this.mockResult(text, 'general_scam'); }

  async predictImage(_form: FormData): Promise<PredictionResult> {
    // Image scoring depends on OCR + the text model, neither of which exist yet —
    // return an honest "not ready" response instead of a fake score.
    return { risk_score: 0, verdict: 'pending', category: null, confidence: 0, source: 'mock', message: 'Image checking is not implemented yet — waiting on the OCR + text model pipeline.' };
  }
}