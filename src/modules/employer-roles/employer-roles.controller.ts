import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { EmployerRolesService } from './employer-roles.service';
import { UploadService } from '../upload/upload.service';
import { AttachAssessmentDto } from './dto/attach-assessment.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { SendRoleAssessmentDto } from './dto/send-role-assessment.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { EmployerRoleStatus } from './entities/employer-role.entity';

const MAX_JD_FILE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_JD_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

@ApiTags('Employer Roles')
@ApiBearerAuth()
@Roles(UserRole.EMPLOYER)
@Controller('employer/roles')
export class EmployerRolesController {
  constructor(
    private readonly rolesService: EmployerRolesService,
    private readonly uploadService: UploadService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new role (supports optional jd_file upload)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['title', 'category'],
      properties: {
        title: { type: 'string', maxLength: 255 },
        category: { type: 'string', maxLength: 255 },
        description: {
          type: 'string',
          maxLength: 50000,
          description: 'Job description text',
        },
        jd_text: {
          type: 'string',
          maxLength: 50000,
          description: 'Alias for description — use one or the other',
        },
        jd_file: {
          type: 'string',
          format: 'binary',
          description: 'PDF/DOC/DOCX, max 5 MB',
        },
        employmentType: {
          type: 'string',
          enum: ['Full-time', 'Part-time', 'Contract', 'Internship'],
        },
        workArrangement: {
          type: 'string',
          enum: ['Remote', 'Hybrid', 'On-site'],
        },
        education: { type: 'string', maxLength: 100 },
        keywords: {
          type: 'array',
          items: { type: 'string' },
        },
        keyword: {
          type: 'array',
          items: { type: 'string' },
          description: 'Alias for keywords — use one or the other',
        },
        salaryMin: { type: 'integer', minimum: 0 },
        salaryMax: { type: 'integer', minimum: 0, maximum: 99999999 },
        currency: { type: 'string', maxLength: 10 },
        assessmentId: {
          type: 'string',
          format: 'uuid',
          description: 'Attach an existing assessment',
        },
        visibility: {
          type: 'string',
          enum: ['public', 'private'],
          default: 'public',
        },
        applicantCap: {
          type: 'integer',
          minimum: 1,
          nullable: true,
          description: 'Maximum interested applicants. Null removes the cap.',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Role created' })
  @UseInterceptors(
    FileInterceptor('jd_file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_JD_FILE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_JD_MIME_TYPES.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              'Only PDF or Word documents are allowed for JD upload.',
            ),
            false,
          );
        }
      },
    }),
  )
  async create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateRoleDto,
    @UploadedFile() jdFile?: Express.Multer.File,
  ) {
    let jdFileUrl: string | null = null;
    if (jdFile) {
      jdFileUrl = await this.uploadService.uploadJdDocument(jdFile);
    }
    const role = await this.rolesService.create(userId, dto, jdFileUrl);
    return { status: 'success', message: 'Role created', data: role };
  }

  @Get()
  @ApiOperation({ summary: 'List all roles for the employer' })
  @ApiQuery({ name: 'status', required: false, enum: EmployerRoleStatus })
  @ApiResponse({ status: 200, description: 'Roles list' })
  async findAll(
    @CurrentUser('sub') userId: string,
    @Query('status') status?: EmployerRoleStatus,
  ) {
    const roles = await this.rolesService.findAllForEmployer(userId, status);
    return { status: 'success', data: roles };
  }

  @Get('active')
  @ApiOperation({
    summary:
      'List active roles — used to populate the Select Role modal during Send Offer flow',
  })
  @ApiResponse({ status: 200, description: 'Active roles list' })
  async findActive(@CurrentUser('sub') userId: string) {
    const roles = await this.rolesService.findActiveRolesForEmployer(userId);
    return { status: 'success', data: roles };
  }

  @Get(':roleId')
  @ApiOperation({ summary: 'Get a single role by ID' })
  @ApiResponse({ status: 200, description: 'Role details' })
  async findOne(
    @CurrentUser('sub') userId: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
  ) {
    const role = await this.rolesService.findOneForEmployer(userId, roleId);
    return { status: 'success', data: role };
  }

  @Get(':roleId/candidates')
  @ApiOperation({ summary: 'List candidates for a role pipeline' })
  @ApiQuery({
    name: 'tab',
    required: false,
    enum: ['best_match', 'other', 'interested', 'all'],
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'search', required: false })
  async listCandidates(
    @CurrentUser('sub') userId: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Query('tab') tab?: 'best_match' | 'other' | 'interested' | 'all',
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    return this.rolesService.listRoleCandidates(userId, roleId, {
      tab,
      page: Number(page ?? 1),
      limit: Number(limit ?? 20),
      search,
    });
  }

  @Post(':roleId/candidates/:candidateId/send-assessment')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send an assessment to a role candidate' })
  async sendAssessmentToCandidate(
    @CurrentUser('sub') userId: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Param('candidateId', ParseUUIDPipe) candidateId: string,
    @Body() dto: SendRoleAssessmentDto,
  ) {
    return this.rolesService.sendAssessmentToCandidate(
      userId,
      roleId,
      candidateId,
      dto.assessmentId,
    );
  }

  @Patch(':roleId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a role (supports optional jd_file upload)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', maxLength: 255 },
        category: { type: 'string', maxLength: 255 },
        description: { type: 'string', maxLength: 50000 },
        jd_text: {
          type: 'string',
          maxLength: 50000,
          description: 'Alias for description',
        },
        jd_file: {
          type: 'string',
          format: 'binary',
          description: 'PDF/DOC/DOCX, max 5 MB',
        },
        employmentType: {
          type: 'string',
          enum: ['Full-time', 'Part-time', 'Contract', 'Internship'],
        },
        workArrangement: {
          type: 'string',
          enum: ['Remote', 'Hybrid', 'On-site'],
        },
        education: { type: 'string', maxLength: 100 },
        keywords: { type: 'array', items: { type: 'string' } },
        keyword: {
          type: 'array',
          items: { type: 'string' },
          description: 'Alias for keywords',
        },
        salaryMin: { type: 'integer', minimum: 0 },
        salaryMax: { type: 'integer', minimum: 0, maximum: 99999999 },
        currency: { type: 'string', maxLength: 10 },
        assessmentId: { type: 'string', format: 'uuid' },
        visibility: {
          type: 'string',
          enum: ['public', 'private'],
        },
        applicantCap: {
          type: 'integer',
          minimum: 1,
          nullable: true,
          description: 'Maximum interested applicants. Null removes the cap.',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Role updated' })
  @UseInterceptors(
    FileInterceptor('jd_file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_JD_FILE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_JD_MIME_TYPES.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              'Only PDF or Word documents are allowed for JD upload.',
            ),
            false,
          );
        }
      },
    }),
  )
  async update(
    @CurrentUser('sub') userId: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Body() dto: UpdateRoleDto,
    @UploadedFile() jdFile?: Express.Multer.File,
  ) {
    let jdFileUrl: string | null | undefined;
    if (jdFile) {
      jdFileUrl = await this.uploadService.uploadJdDocument(jdFile);
    }
    const role = await this.rolesService.update(userId, roleId, dto, jdFileUrl);
    return { status: 'success', message: 'Role updated', data: role };
  }

  @Patch(':roleId/close')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Close a role (no new offers can be sent)' })
  @ApiResponse({ status: 200, description: 'Role closed' })
  async close(
    @CurrentUser('sub') userId: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
  ) {
    const role = await this.rolesService.close(userId, roleId);
    return { status: 'success', message: 'Role closed', data: role };
  }

  @Patch(':roleId/assessment')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Attach an existing assessment to a role' })
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async attachAssessment(
    @CurrentUser('sub') userId: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Body() dto: AttachAssessmentDto,
  ) {
    const role = await this.rolesService.attachAssessment(
      userId,
      roleId,
      dto.assessmentId,
    );
    return {
      status: 'success',
      message: 'Assessment attached to role',
      data: role,
    };
  }

  @Patch(':roleId/reopen')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reopen a closed role' })
  @ApiResponse({ status: 200, description: 'Role reopened' })
  async reopen(
    @CurrentUser('sub') userId: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
  ) {
    const role = await this.rolesService.reopen(userId, roleId);
    return { status: 'success', message: 'Role reopened', data: role };
  }
}
