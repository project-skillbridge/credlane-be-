import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AdminTiers } from '../../../common/decorators/admin-tiers.decorator';
import { PersonalAssessmentQuestionService } from '../../talent/assessment/personal-assessment-question.service';
import type {
  PersonalAssessmentQuestionImportItem,
  PersonalAssessmentQuestionImportResult,
} from '../../talent/assessment/personal-assessment-question-import.types';
import { AdminTier, UserRole } from '../../users/entities/user.entity';
import { ImportPersonalAssessmentQuestionsDto } from './dto/import-personal-assessment-questions.dto';

@ApiTags('admin-personal-assessment')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@AdminTiers(AdminTier.SUPER_ADMIN, AdminTier.ADMIN)
@Controller('admin/personal-assessment/questions')
export class AdminPersonalAssessmentQuestionsController {
  constructor(
    private readonly personalAssessmentQuestionService: PersonalAssessmentQuestionService,
  ) {}

  @Post('import')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Import personal assessment questions (admin only)',
    description:
      'Upserts personal assessment questions by id or field_name, then reloads the in-memory question catalog.',
  })
  @ApiUnprocessableEntityResponse({
    description: 'Validation failed for one or more question objects',
  })
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    }),
  )
  async importQuestions(@Body() dto: ImportPersonalAssessmentQuestionsDto) {
    const questions: PersonalAssessmentQuestionImportItem[] = dto.questions.map(
      (item) => ({
        id: item.id,
        section: item.section,
        track: item.track,
        question: item.question,
        fieldName: item.fieldName,
        format: item.format,
        required: item.required,
        note: item.note,
        options: item.options,
        trackVariants: item.trackVariants,
      }),
    );

    const result: PersonalAssessmentQuestionImportResult =
      await this.personalAssessmentQuestionService.importQuestions(questions);

    return {
      status: 'success',
      message: 'Personal assessment questions imported',
      data: result,
    };
  }
}
