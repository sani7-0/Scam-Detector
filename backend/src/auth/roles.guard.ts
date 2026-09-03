import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector, private db: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRole = this.reflector.get<string>('role', context.getHandler());
    if (!requiredRole) return true;
    const request = context.switchToHttp().getRequest();
    const userRole = await this.db.getUserRole(request.user.id);
    if (userRole !== requiredRole) throw new ForbiddenException('You do not have access to this resource.');
    return true;
  }
}