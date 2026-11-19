import { Controller, Get, Header } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { ExportService } from './export.service.js';

// 記録の書き出し（C-01）。ログイン必須（共通のガードが既定で守る）。自分の記録だけが出る
@ApiTags('export')
@Controller('me/export.csv')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get()
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="fitlog-records.csv"')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ operationId: 'exportRecordsCsv', summary: '自分の筋トレのセット・ランの記録を CSV（UTF-8 BOM 付き）で返す' })
  @ApiProduces('text/csv')
  @ApiOkResponse({ description: 'CSV（先頭に BOM・改行は CRLF）', schema: { type: 'string' } })
  exportCsv(@Session() session: UserSession): Promise<string> {
    return this.exportService.exportCsv(session.user.id);
  }
}
