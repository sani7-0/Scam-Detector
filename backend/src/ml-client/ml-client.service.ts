import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class MlClientService {
  constructor(private http: HttpService, private config: ConfigService) {}

  private base() { return this.config.getOrThrow<string>('ML_SERVICE_URL'); }

  async predictUrl(url: string) {
    const { data } = await firstValueFrom(this.http.post(`${this.base()}/predict/url`, { text: url }));
    return data;
  }

  async predictText(text: string) {
    const { data } = await firstValueFrom(this.http.post(`${this.base()}/predict/text`, { text }));
    return data;
  }

  async predictImage(formData: FormData) {
    const { data } = await firstValueFrom(this.http.post(`${this.base()}/predict/image`, formData));
    return data;
  }
}