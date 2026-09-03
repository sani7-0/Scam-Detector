import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RequireAuthGuard } from '../auth/require-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseService } from '../supabase/supabase.service';

@ApiTags('me')
@ApiBearerAuth()
@UseGuards(RequireAuthGuard)
@Controller('me')
export class MeController {
  constructor(private db: SupabaseService) {}

  @Get('stats')
  @ApiOperation({ summary: "The logged-in user's own check history and scam ratio" })
  stats(@CurrentUser() user: { id: string }) {
    return this.db.getUserStats(user.id);
  }
}