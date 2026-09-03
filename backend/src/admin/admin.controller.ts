import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RequireAuthGuard } from '../auth/require-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SupabaseService } from '../supabase/supabase.service';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(RequireAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin')
export class AdminController {
  constructor(private db: SupabaseService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Global stats: total checked, total scams, breakdown by category (admin only)' })
  stats() {
    return this.db.getAdminStats();
  }

  @Get('recent-scams')
  @ApiOperation({ summary: 'The most recent flagged scam submissions, with their actual content (admin only) — for reviewing real examples, not just counts' })
  recentScams() {
    return this.db.getRecentScams();
  }
}