import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { MeController } from './me.controller';

@Module({ imports: [AuthModule, SupabaseModule], controllers: [MeController] })
export class MeModule {}