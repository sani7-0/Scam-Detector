import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { MlPredictor, PredictionResult } from './ml-predictor.interface';

@Injectable()
export class RealMlService implements MlPredictor {
  private readonly logger = new Logger(RealMlService.name);
  constructor(private http: HttpService, private config: ConfigService) {}

  private base() { return this.config.getOrThrow<string>('ML_SERVICE_URL'); }

  private unavailable(message: string): PredictionResult {
    return { risk_score: 0, verdict: 'pending', category: null, confidence: 0, source: 'error', message };
  }

  private validate(data: any): PredictionResult {
    if (typeof data?.risk_score !== 'number' || !data?.verdict) {
      this.logger.warn(`ML service returned a malformed response: ${JSON.stringify(data)}`);
      return this.unavailable('ML service returned an invalid response');
    }
    return {
      risk_score: data.risk_score,
      verdict: data.verdict,
      category: data.category ?? null,
      confidence: data.confidence ?? data.risk_score,
      source: 'model',
    };
  }

  async predictUrl(url: string): Promise<PredictionResult> {
    try {
      const { data } = await firstValueFrom(this.http.post(`${this.base()}/predict/url`, { text: url }, { timeout: 5000 }));
      return this.validate(data);
    } catch (err: any) {
      this.logger.error(`URL prediction failed: ${err.message}`);
      return this.unavailable('ML service unavailable for URL check');
    }
  }

  async predictText(text: string): Promise<PredictionResult> {
    try {
      const { data } = await firstValueFrom(this.http.post(`${this.base()}/predict/text`, { text }, { timeout: 5000 }));
      return this.validate(data);
    } catch (err: any) {
      this.logger.error(`Text prediction failed: ${err.message}`);
      return this.unavailable('ML service unavailable for text check');
    }
  }

  async predictImage(form: FormData): Promise<PredictionResult> {
    try {
      const { data } = await firstValueFrom(this.http.post(`${this.base()}/predict/image`, form, { timeout: 8000 }));
      return this.validate(data);
    } catch (err: any) {
      this.logger.error(`Image prediction failed: ${err.message}`);
      return this.unavailable('ML service unavailable for image check');
    }
  }
}