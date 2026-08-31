import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Controller('health')
export class HealthController {
  constructor(private config: ConfigService, private http: HttpService) {}

  @Get()
  async check() {
    const useMock = this.config.get<boolean>('USE_MOCK_ML') === true;
    let mlStatus = 'mocked';
    if (!useMock) {
      try {
        await firstValueFrom(this.http.get(`${this.config.getOrThrow('ML_SERVICE_URL')}/health`, { timeout: 2000 }));
        mlStatus = 'up';
      } catch {
        mlStatus = 'down';
      }
    }
    return { status: 'ok', timestamp: new Date().toISOString(), ml_service: mlStatus };
  }
}