import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AdminTiers } from '../../../common/decorators/admin-tiers.decorator';
import { AdminTier, UserRole } from '../../users/entities/user.entity';
import { QuestionImportService } from '../../../database/import/question-import.service';
import { ImportQuestionsByUrlDto } from './dto/import-questions.dto';

@ApiTags('admin-questions')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@AdminTiers(AdminTier.SUPER_ADMIN, AdminTier.ADMIN)
@Controller('admin/questions')
export class AdminQuestionsController {
  constructor(private readonly questionImportService: QuestionImportService) {}

  @Post('import')
  @ApiOperation({
    summary: 'Import question bank from uploaded file or Google Drive link',
  })
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        drive_url: { type: 'string' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  async importQuestions(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: ImportQuestionsByUrlDto,
  ) {
    if (!file && !body.drive_url) {
      return {
        status: 'error',
        message: 'Provide either a file upload or drive_url',
      };
    }

    await this.questionImportService.deactivateLegacyPlaceholderQuestions();

    const result = await this.questionImportService.importFromInput({
      fileBuffer: file?.buffer,
      fileName: file?.originalname,
      driveUrl: body.drive_url,
    });

    return {
      status: 'success',
      message: 'Question bank import completed',
      data: result,
    };
  }
}
