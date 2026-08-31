import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CheckController } from './check.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { MlClientModule } from '../ml-client/ml-client.module';

@Module({
  imports: [SupabaseModule, MlClientModule, HttpModule],
  controllers: [CheckController],
})
export class CheckModule {}