import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { OptionalAuthGuard } from './optional-auth.guard';
import { RequireAuthGuard } from './require-auth.guard';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [SupabaseModule],
  providers: [OptionalAuthGuard, RequireAuthGuard, RolesGuard],
  exports: [OptionalAuthGuard, RequireAuthGuard, RolesGuard],
})
export class AuthModule {}