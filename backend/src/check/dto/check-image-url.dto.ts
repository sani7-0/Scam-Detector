import { ApiProperty } from '@nestjs/swagger';
import { IsUrl, IsNotEmpty } from 'class-validator';

export class CheckImageUrlDto {
  @ApiProperty({ example: 'https://example.com/some-image.png' })
  @IsNotEmpty()
  @IsUrl({ require_protocol: true })
  imageUrl: string;
}