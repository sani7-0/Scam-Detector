import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CheckTextDto {
  @ApiProperty({ example: 'Congratulations! You won a prize, click here to claim', description: 'Message, post, or job listing text to check' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  text: string;
}