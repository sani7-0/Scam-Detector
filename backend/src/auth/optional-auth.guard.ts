import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(private db: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];
    request.user = null;
    if (authHeader?.startsWith('Bearer ')) {
      request.user = await this.db.getUserFromToken(authHeader.slice(7));
    }
    return true;
  }
}