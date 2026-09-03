import { Controller, Post, Get, Body, UploadedFile, UseInterceptors, UseGuards, Inject, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { createHash } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { ML_PREDICTOR } from '../ml-client/ml-client.module';
import type { MlPredictor, PredictionResult } from '../ml-client/ml-predictor.interface';
import { CheckUrlDto } from './dto/check-url.dto';
import { CheckTextDto } from './dto/check-text.dto';
import { CheckAutoDto } from './dto/check-auto.dto';
import { CheckImageUrlDto } from './dto/check-image-url.dto';
import { PredictionResultDto } from './dto/prediction-result.dto';

function hash(input: string) {
  return createHash('sha256').update(input).digest('hex');
}

// A single string is treated as a URL if it has no whitespace and parses
// cleanly as one (with "http://" assumed if no scheme was given). Anything
// else — sentences, messages, multi-line pastes — is treated as text.
function normalizeIfUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  try {
    const url = new URL(candidate);
    if (!url.hostname.includes('.')) return null; // require an actual domain-looking hostname
    return candidate;
  } catch {
    return null;
  }
}

@ApiTags('check')
@UseGuards(ThrottlerGuard)
@Controller('check')
export class CheckController {
  constructor(
    @Inject(ML_PREDICTOR) private ml: MlPredictor,
    private db: SupabaseService,
    private http: HttpService,
  ) 
  constructor1(@Inject(ML_PREDICTOR) private ml: MlPredictor, ...) {
  console.log('ML_PREDICTOR resolved to:', ml.constructor.name);
}
  {}

  // ---- shared handlers, reused by both the explicit routes and /check (auto) ----

  private async handleUrl(url: string): Promise<PredictionResult> {
    const domain = new URL(url).hostname;
    if (await this.db.isAllowlisted(domain)) {
      return { risk_score: 0, verdict: 'safe', category: null, confidence: 1, source: 'allowlist' };
    }
    const h = hash(url);
    const cached = await this.db.getCached(h);
    if (cached) return cached;

    const result = await this.ml.predictUrl(url);
    await this.db.setCache(h, result);
    await this.db.logResult(h, 'url', result);
    return result;
  }

  private async handleText(text: string): Promise<PredictionResult> {
    const h = hash(text);
    const cached = await this.db.getCached(h);
    if (cached) return cached;

    const result = await this.ml.predictText(text);
    await this.db.setCache(h, result);
    await this.db.logResult(h, 'text', result);
    return result;
  }

  private async handleImageBuffer(buffer: Buffer, filename: string): Promise<PredictionResult> {
    const form = new FormData();
    form.append('file', new Blob([buffer as any]), filename);
    const result = await this.ml.predictImage(form as any);
    await this.db.logResult(hash(filename + Date.now()), 'image', result);
    return result;
  }

  // ---- explicit routes (used by the website's URL/Text/Image tabs) ----

  @Post('url')
  @ApiOperation({ summary: 'Check a URL for phishing risk' })
  @ApiResponse({ status: 201, type: PredictionResultDto })
  checkUrl(@Body() dto: CheckUrlDto) {
    return this.handleUrl(dto.url);
  }

  @Post('text')
  @ApiOperation({ summary: 'Check text, a message, post, or job listing for scam signals' })
  @ApiResponse({ status: 201, type: PredictionResultDto })
  checkText(@Body() dto: CheckTextDto) {
    return this.handleText(dto.text);
  }

  @Post('image')
  @ApiOperation({ summary: 'Check an uploaded image (OCR + scam text/QR analysis)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiResponse({ status: 201, type: PredictionResultDto })
  @UseInterceptors(FileInterceptor('file'))
  checkImage(@UploadedFile() file: Express.Multer.File) {
    return this.handleImageBuffer(file.buffer, file.originalname);
  }

  // ---- new: auto-detect route, for clients that don't know the input type ahead of time ----

  @Post()
  @ApiOperation({ summary: 'Auto-detect whether the input is a URL, text, or image, and check it accordingly' })
  @ApiConsumes('application/json', 'multipart/form-data')
  @ApiBody({
    schema: {
      oneOf: [
        { type: 'object', properties: { input: { type: 'string', example: 'http://example.com or any pasted text' } } },
        { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
      ],
    },
  })
  @ApiResponse({ status: 201, type: PredictionResultDto })
  @UseInterceptors(FileInterceptor('file'))
  async checkAuto(@UploadedFile() file: Express.Multer.File, @Body() body: CheckAutoDto) {
    if (file) return this.handleImageBuffer(file.buffer, file.originalname);

    const input = (body?.input ?? '').trim();
    if (!input) throw new BadRequestException('Provide either "input" (a URL or text) or a "file" (image).');

        const normalizedUrl = normalizeIfUrl(input);
        return normalizedUrl ? this.handleUrl(normalizedUrl) : this.handleText(input); 
  }

  // ---- new: check an image by URL (backend fetches it) — for the extension's right-click-on-image case ----

  @Post('image-url')
  @ApiOperation({ summary: "Check an image the backend fetches from a URL (e.g. an extension's right-clicked image src)" })
  @ApiResponse({ status: 201, type: PredictionResultDto })
  async checkImageUrl(@Body() dto: CheckImageUrlDto) {
    let buffer: Buffer;
    try {
      const response = await firstValueFrom(
        this.http.get(dto.imageUrl, { responseType: 'arraybuffer', timeout: 5000 }),
      );
      buffer = Buffer.from(response.data);
    } catch (err) {
      throw new BadRequestException('Could not fetch the image from the given URL.');
    }
    return this.handleImageBuffer(buffer, 'fetched-image');
  }

  @Get('stats')
  @ApiOperation({ summary: 'Aggregate counts of flagged results by category' })
  async getStats() {
    return this.db.getStats();
  }
}
