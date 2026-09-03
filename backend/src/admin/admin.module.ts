import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AuthModule } from '../auth/auth.module';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({ imports: [AuthModule, SupabaseModule], controllers: [AdminController] })
export class AdminModule {}