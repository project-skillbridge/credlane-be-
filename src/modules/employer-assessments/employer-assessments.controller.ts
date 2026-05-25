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
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import {
  ApiCreateEmployerAssessment,
  ApiDeactivateEmployerAssessment,
  ApiDownloadCsvTemplate,
  ApiDownloadXlsxTemplate,
  ApiEmployerAssessmentsTags,
  ApiGetEmployerAssessment,
  ApiGetPublicAssessment,
  ApiImportAssessmentQuestions,
  ApiListEmployerAssessmentResults,
  ApiListEmployerAssessments,
  ApiSearchAssessmentCandidates,
  ApiSubmitEmployerAssessment,
} from './docs/employer-assessments.swagger';
import { CreateEmployerAssessmentDto } from './dto/create-employer-assessment.dto';
import { ListEmployerAssessmentResultsQueryDto } from './dto/list-employer-assessment-results-query.dto';
import { SearchAssessmentCandidatesQueryDto } from './dto/search-assessment-candidates-query.dto';
import { SubmitEmployerAssessmentDto } from './dto/submit-employer-assessment.dto';
import { EMPLOYER_ASSESSMENT_IMPORT_MAX_FILE_BYTES } from './employer-assessments.constants';
import { EmployerAssessmentsService } from './employer-assessments.service';

@ApiEmployerAssessmentsTags()
@Controller()
export class EmployerAssessmentsController {
  constructor(
    private readonly employerAssessmentsService: EmployerAssessmentsService,
  ) {}

  @Post('employer/assessments')
  @Roles(UserRole.EMPLOYER)
  @ApiCreateEmployerAssessment()
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
  @ApiListEmployerAssessments()
  listAssessments(@CurrentUser('sub') employerUserId: string) {
    return this.employerAssessmentsService.listAssessments(employerUserId);
  }

  @Get('employer/assessments/candidates')
  @Roles(UserRole.EMPLOYER)
  @ApiSearchAssessmentCandidates()
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
  @ApiDownloadCsvTemplate()
  downloadCsvTemplate(@Res() response: Response): Response {
    response.setHeader('Content-Type', 'text/csv');
    response.setHeader(
      'Content-Disposition',
      'attachment; filename="credlane-question-template.csv"',
    );
    return response.send(this.employerAssessmentsService.getTemplateCsv());
  }

  @Get('employer/assessments/template.xlsx')
  @Roles(UserRole.EMPLOYER)
  @ApiDownloadXlsxTemplate()
  downloadXlsxTemplate(@Res() response: Response): Response {
    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    response.setHeader(
      'Content-Disposition',
      'attachment; filename="credlane-question-template.xlsx"',
    );
    return response.send(this.employerAssessmentsService.getTemplateXlsx());
  }

  @Post('employer/assessments/import-questions')
  @Roles(UserRole.EMPLOYER)
  @ApiImportAssessmentQuestions()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: EMPLOYER_ASSESSMENT_IMPORT_MAX_FILE_BYTES },
    }),
  )
  importQuestions(@UploadedFile() file: Express.Multer.File | undefined) {
    return this.employerAssessmentsService.validateUploadedQuestionFile(file);
  }

  @Get('employer/assessments/:assessmentId')
  @Roles(UserRole.EMPLOYER)
  @ApiGetEmployerAssessment()
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
  @ApiDeactivateEmployerAssessment()
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
  @ApiListEmployerAssessmentResults()
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
  @ApiGetPublicAssessment()
  getPublicAssessment(@Param('token') token: string) {
    return this.employerAssessmentsService.getPublicAssessmentByToken(token);
  }

  @Post('assessments/link/:token/submissions')
  @Roles(UserRole.TALENT)
  @ApiSubmitEmployerAssessment()
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
