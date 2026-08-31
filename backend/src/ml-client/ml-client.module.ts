import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MockMlService } from './mock-ml.service';
import { RealMlService } from './real-ml.service';

export const ML_PREDICTOR = 'ML_PREDICTOR';

@Module({
  imports: [HttpModule],
  providers: [
    MockMlService,
    RealMlService,
    {
      provide: ML_PREDICTOR,
      useFactory: (config: ConfigService, mock: MockMlService, real: RealMlService) =>
        config.get<boolean>('USE_MOCK_ML') === true ? mock : real,
      inject: [ConfigService, MockMlService, RealMlService],
    },
  ],
  exports: [ML_PREDICTOR],
})
export class MlClientModule {}