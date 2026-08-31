import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CheckAutoDto {
  @ApiPropertyOptional({ example: 'http://example.com', description: 'A URL or any block of text — auto-detected server-side. Omit this and send a "file" instead to check an image.' })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  input?: string;
}