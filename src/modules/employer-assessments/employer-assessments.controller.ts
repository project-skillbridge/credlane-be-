import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
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
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CreateEmployerAssessmentDto } from './dto/create-employer-assessment.dto';
import { ListEmployerAssessmentResultsQueryDto } from './dto/list-employer-assessment-results-query.dto';
import { SearchAssessmentCandidatesQueryDto } from './dto/search-assessment-candidates-query.dto';
import { SubmitEmployerAssessmentDto } from './dto/submit-employer-assessment.dto';
import { EmployerAssessmentsService } from './employer-assessments.service';

@ApiTags('Employer Assessments')
@ApiBearerAuth()
@Controller()
export class EmployerAssessmentsController {
  constructor(
    private readonly employerAssessmentsService: EmployerAssessmentsService,
  ) {}

  @Post('employer/assessments')
  @Roles(UserRole.EMPLOYER)
  @ApiOperation({ summary: 'Create and generate a new employer assessment' })
  createAssessment(
    @CurrentUser('sub') employerUserId: string,
    @Body() dto: CreateEmployerAssessmentDto,
  ) {
    return this.employerAssessmentsService.createAssessment(
      employerUserId,
      dto,
    );
  }

  @Get('employer/assessments')
  @Roles(UserRole.EMPLOYER)
  @ApiOperation({ summary: 'List assessments for this employer' })
  listAssessments(@CurrentUser('sub') employerUserId: string) {
    return this.employerAssessmentsService.listAssessments(employerUserId);
  }

  @Get('employer/assessments/candidates')
  @Roles(UserRole.EMPLOYER)
  @ApiOperation({ summary: 'Search shortlisted candidates for direct sending' })
  searchCandidates(
    @CurrentUser('sub') employerUserId: string,
    @Query() query: SearchAssessmentCandidatesQueryDto,
  ) {
    return this.employerAssessmentsService.searchCandidates(
      employerUserId,
      query,
    );
  }

  @Get('employer/assessments/template.csv')
  @Roles(UserRole.EMPLOYER)
  @ApiOperation({ summary: 'Download CredLane question template (CSV)' })
  downloadCsvTemplate(@Res() response: Response) {
    response.setHeader('Content-Type', 'text/csv');
    response.setHeader(
      'Content-Disposition',
      'attachment; filename="credlane-question-template.csv"',
    );
    response.send(this.employerAssessmentsService.getTemplateCsv());
  }

  @Get('employer/assessments/template.xlsx')
  @Roles(UserRole.EMPLOYER)
  @ApiOperation({ summary: 'Download CredLane question template (XLSX)' })
  downloadXlsxTemplate(@Res() response: Response) {
    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    response.setHeader(
      'Content-Disposition',
      'attachment; filename="credlane-question-template.xlsx"',
    );
    response.send(this.employerAssessmentsService.getTemplateXlsx());
  }

  @Post('employer/assessments/import-questions')
  @Roles(UserRole.EMPLOYER)
  @ApiOperation({
    summary: 'Validate and import company questions from CSV or XLSX',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  importQuestions(@UploadedFile() file: Express.Multer.File | undefined) {
    return this.employerAssessmentsService.validateUploadedQuestionFile(file);
  }

  @Get('employer/assessments/:assessmentId')
  @Roles(UserRole.EMPLOYER)
  @ApiOperation({ summary: 'Get assessment detail' })
  getAssessment(
    @CurrentUser('sub') employerUserId: string,
    @Param('assessmentId', ParseUUIDPipe) assessmentId: string,
  ) {
    return this.employerAssessmentsService.getAssessment(
      employerUserId,
      assessmentId,
    );
  }

  @Patch('employer/assessments/:assessmentId/deactivate')
  @Roles(UserRole.EMPLOYER)
  @ApiOperation({ summary: 'Deactivate assessment link' })
  deactivateAssessment(
    @CurrentUser('sub') employerUserId: string,
    @Param('assessmentId', ParseUUIDPipe) assessmentId: string,
  ) {
    return this.employerAssessmentsService.deactivateAssessment(
      employerUserId,
      assessmentId,
    );
  }

  @Get('employer/assessments/:assessmentId/results')
  @Roles(UserRole.EMPLOYER)
  @ApiOperation({ summary: 'List assessment submissions and results' })
  listResults(
    @CurrentUser('sub') employerUserId: string,
    @Param('assessmentId', ParseUUIDPipe) assessmentId: string,
    @Query() query: ListEmployerAssessmentResultsQueryDto,
  ) {
    return this.employerAssessmentsService.listResults(
      employerUserId,
      assessmentId,
      query,
    );
  }

  @Get('assessments/link/:token')
  @Public()
  @ApiOperation({ summary: 'Get public assessment by share token' })
  getPublicAssessment(@Param('token') token: string) {
    return this.employerAssessmentsService.getPublicAssessmentByToken(token);
  }

  @Post('assessments/link/:token/submissions')
  @Roles(UserRole.TALENT)
  @ApiOperation({ summary: 'Submit an employer assessment as a candidate' })
  submitAssessment(
    @CurrentUser('sub') candidateUserId: string,
    @Param('token') token: string,
    @Body() dto: SubmitEmployerAssessmentDto,
  ) {
    return this.employerAssessmentsService.submitAssessment(
      candidateUserId,
      token,
      dto,
    );
  }
}
