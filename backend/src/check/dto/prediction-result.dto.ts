import { ApiProperty } from '@nestjs/swagger';

export class PredictionResultDto {
  @ApiProperty({ example: 0.94, minimum: 0, maximum: 1 }) risk_score: number;
  @ApiProperty({ enum: ['safe', 'suspicious', 'scam', 'pending'] }) verdict: string;
  @ApiProperty({ example: 'phishing', nullable: true }) category: string | null;
  @ApiProperty({ example: 0.94, minimum: 0, maximum: 1 }) confidence: number;
  @ApiProperty({ example: 'mock', description: 'Which model/source produced this result' }) source: string;
  @ApiProperty({ type: [String], required: false }) reasons?: string[];
}