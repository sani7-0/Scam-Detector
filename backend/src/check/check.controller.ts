import {
  Controller,
  Post,
  Get,
  Body,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  Inject,
  BadRequestException,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';
import { ThrottlerGuard } from '@nestjs/throttler';

import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';

import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { createHash } from 'crypto';

import { SupabaseService } from '../supabase/supabase.service';
import { ML_PREDICTOR } from '../ml-client/ml-client.module';

import type {
  MlPredictor,
  PredictionResult,
} from '../ml-client/ml-predictor.interface';

import { CheckUrlDto } from './dto/check-url.dto';
import { CheckTextDto } from './dto/check-text.dto';
import { CheckAutoDto } from './dto/check-auto.dto';
import { CheckImageUrlDto } from './dto/check-image-url.dto';
import { PredictionResultDto } from './dto/prediction-result.dto';

import { OptionalAuthGuard } from '../auth/optional-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

function hash(input: string) {
  return createHash('sha256').update(input).digest('hex');
}

function normalizeIfUrl(input: string): string | null {
  const trimmed = input.trim();

  if (!trimmed || /\s/.test(trimmed)) return null;

  const candidate = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `http://${trimmed}`;

  try {
    const url = new URL(candidate);

    if (!url.hostname.includes('.')) return null;

    return candidate;
  } catch {
    return null;
  }
}

@ApiTags('check')
@UseGuards(ThrottlerGuard, OptionalAuthGuard)
@Controller('check')
export class CheckController {
  constructor(
  @Inject(ML_PREDICTOR) private ml: MlPredictor,
  private db: SupabaseService,
  private http: HttpService,
) {
  console.log('ML_PREDICTOR resolved to:', this.ml.constructor.name);
}
  private async handleUrl(
    url: string,
    userId?: string,
  ): Promise<PredictionResult> {
    const domain = new URL(url).hostname;

    if (await this.db.isAllowlisted(domain)) {
      return {
        risk_score: 0,
        verdict: 'safe',
        category: null,
        confidence: 1,
        source: 'allowlist',
      };
    }

    const h = hash(url);
    const cached = await this.db.getCached(h);

    if (cached) return cached;

    const result = await this.ml.predictUrl(url);

    await this.db.setCache(h, result);
    await this.db.logResult(h, 'url', result, userId);

    return result;
  }

  private async handleText(
    text: string,
    userId?: string,
  ): Promise<PredictionResult> {
    const h = hash(text);
    const cached = await this.db.getCached(h);

    if (cached) return cached;

    const result = await this.ml.predictText(text);

    await this.db.setCache(h, result);
    await this.db.logResult(h, 'text', result, userId);

    return result;
  }

  private async handleImageBuffer(
    buffer: Buffer,
    filename: string,
    userId?: string,
  ): Promise<PredictionResult> {
    const form = new FormData();

    form.append(
      'file',
      new Blob([buffer as any]),
      filename,
    );

    const result = await this.ml.predictImage(form as any);

    await this.db.logResult(
      hash(filename + Date.now()),
      'image',
      result,
      userId,
    );

    return result;
  }

  @Post('url')
  @ApiOperation({ summary: 'Check a URL for phishing risk' })
  @ApiResponse({ status: 201, type: PredictionResultDto })
  checkUrl(
    @Body() dto: CheckUrlDto,
    @CurrentUser() user: any,
  ) {
    return this.handleUrl(dto.url, user?.id);
  }

  @Post('text')
  @ApiOperation({
    summary:
      'Check text, a message, post, or job listing for scam signals',
  })
  @ApiResponse({ status: 201, type: PredictionResultDto })
  checkText(
    @Body() dto: CheckTextDto,
    @CurrentUser() user: any,
  ) {
    return this.handleText(dto.text, user?.id);
  }

  @Post('image')
  @ApiOperation({
    summary: 'Check an uploaded image (OCR + scam text/QR analysis)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 201, type: PredictionResultDto })
  @UseInterceptors(FileInterceptor('file'))
  checkImage(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
  ) {
    return this.handleImageBuffer(
      file.buffer,
      file.originalname,
      user?.id,
    );
  }

  @Post()
  @ApiOperation({
    summary:
      'Auto-detect whether the input is a URL, text, or image, and check it accordingly',
  })
  @ApiConsumes('application/json', 'multipart/form-data')
  @ApiBody({
    schema: {
      oneOf: [
        {
          type: 'object',
          properties: {
            input: {
              type: 'string',
              example:
                'http://example.com or any pasted text',
            },
          },
        },
        {
          type: 'object',
          properties: {
            file: {
              type: 'string',
              format: 'binary',
            },
          },
        },
      ],
    },
  })
  @ApiResponse({ status: 201, type: PredictionResultDto })
  @UseInterceptors(FileInterceptor('file'))
  async checkAuto(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: CheckAutoDto,
    @CurrentUser() user: any,
  ) {
    if (file) {
      return this.handleImageBuffer(
        file.buffer,
        file.originalname,
        user?.id,
      );
    }

    const input = (body?.input ?? '').trim();

    if (!input) {
      throw new BadRequestException(
        'Provide either "input" (a URL or text) or a "file" (image).',
      );
    }

    const normalizedUrl = normalizeIfUrl(input);

    return normalizedUrl
      ? this.handleUrl(normalizedUrl, user?.id)
      : this.handleText(input, user?.id);
  }

  @Post('image-url')
  @ApiOperation({
    summary:
      "Check an image the backend fetches from a URL (e.g. an extension's right-clicked image src)",
  })
  @ApiResponse({ status: 201, type: PredictionResultDto })
  async checkImageUrl(
    @Body() dto: CheckImageUrlDto,
  ) {
    let buffer: Buffer;

    try {
      const response = await firstValueFrom(
        this.http.get(dto.imageUrl, {
          responseType: 'arraybuffer',
          timeout: 5000,
        }),
      );

      buffer = Buffer.from(response.data);
    } catch (err) {
      throw new BadRequestException(
        'Could not fetch the image from the given URL.',
      );
    }

    return this.handleImageBuffer(
      buffer,
      'fetched-image',
    );
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Aggregate counts of flagged results by category',
  })
  async getStats() {
    return this.db.getStats();
  }
}
