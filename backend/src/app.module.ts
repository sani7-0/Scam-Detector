import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { HttpModule } from '@nestjs/axios';
import * as Joi from 'joi';
import { CheckModule } from './check/check.module';
import { SupabaseModule } from './supabase/supabase.module';
import { MlClientModule } from './ml-client/ml-client.module';
import { HealthModule } from './health/health.module';
import { MeModule } from './me/me.module';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        SUPABASE_URL: Joi.string().uri().required(),
        SUPABASE_SERVICE_KEY: Joi.string().required(),
        ML_SERVICE_URL: Joi.string().uri().required(),
        USE_MOCK_ML: Joi.boolean().default(true),
        PORT: Joi.number().default(3000),
      }),
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 30 }]),
    HttpModule,
    CheckModule,
    SupabaseModule,
    MlClientModule,
    HealthModule,
    AuthModule,
    MeModule,
    AdminModule
  ],
})
export class AppModule {}