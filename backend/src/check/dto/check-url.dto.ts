import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUrl } from 'class-validator';

export class CheckUrlDto {
  @ApiProperty({ example: 'http://example.com', description: 'The URL to check for phishing risk' })
  @IsNotEmpty()
  @IsUrl({ require_protocol: true })
  url: string;
}