import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class RequireAuthGuard implements CanActivate {
  constructor(private db: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedException('Login required.');
    const user = await this.db.getUserFromToken(authHeader.slice(7));
    if (!user) throw new UnauthorizedException('Invalid or expired session.');
    request.user = user;
    return true;
  }
}