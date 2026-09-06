import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
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
      useClass: RealMlService,
    },
  ],
  exports: [ML_PREDICTOR],
})
export class MlClientModule {}
