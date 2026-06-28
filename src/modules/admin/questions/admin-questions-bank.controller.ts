import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AdminTiers } from '../../../common/decorators/admin-tiers.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AdminTier, UserRole } from '../../users/entities/user.entity';
import { AdminQuestionsBankService } from './admin-questions-bank.service';
import { ListQuestionsQueryDto } from './dto/list-questions-query.dto';
import { AddQuestionDto } from './dto/add-question.dto';
import { EditQuestionDto } from './dto/edit-question.dto';
import { AddQuestionQualityNoteDto } from './dto/question-quality-note.dto';

@ApiTags('admin-question-bank')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@AdminTiers(AdminTier.SUPER_ADMIN, AdminTier.ADMIN, AdminTier.REVIEWER)
@Controller('admin/question-bank')
export class AdminQuestionsBankController {
  constructor(
    private readonly adminQuestionsBankService: AdminQuestionsBankService,
  ) {}

  @Get('questions')
  @ApiOperation({ summary: 'List question bank entries with filters' })
  async findAll(@Query() query: ListQuestionsQueryDto) {
    return this.adminQuestionsBankService.findAll(query);
  }

  @Get('questions/:id')
  @ApiOperation({ summary: 'Get a single question bank entry' })
  async findOne(@Param('id') id: string) {
    return this.adminQuestionsBankService.findOne(id);
  }

  @Patch('questions/:id/flag')
  @ApiOperation({
    summary: 'Flag a question for review (does not remove it from rotation)',
  })
  async flag(@Param('id') id: string) {
    return this.adminQuestionsBankService.flag(id);
  }

  @Patch('questions/:id/remove')
  @AdminTiers(AdminTier.SUPER_ADMIN, AdminTier.ADMIN)
  @ApiOperation({
    summary: 'Remove a question — stops it from being served to candidates',
  })
  async remove(@Param('id') id: string) {
    return this.adminQuestionsBankService.remove(id);
  }

  @Patch('questions/:id/restore')
  @AdminTiers(AdminTier.SUPER_ADMIN, AdminTier.ADMIN)
  @ApiOperation({ summary: 'Restore a removed question back into rotation' })
  async restore(@Param('id') id: string) {
    return this.adminQuestionsBankService.restore(id);
  }

  @Patch('questions/:id')
  @AdminTiers(AdminTier.SUPER_ADMIN, AdminTier.ADMIN)
  @ApiOperation({ summary: 'Edit question text, options, or correct answer' })
  async edit(@Param('id') id: string, @Body() dto: EditQuestionDto) {
    return this.adminQuestionsBankService.edit(id, dto);
  }

  @Post('questions')
  @AdminTiers(AdminTier.SUPER_ADMIN, AdminTier.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Manually add a question to the bank' })
  async addManual(
    @Body() dto: AddQuestionDto,
    @CurrentUser('sub') addedBy: string,
  ) {
    return this.adminQuestionsBankService.addManual(dto, addedBy);
  }

  @Post('questions/:id/quality-notes')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a quality note to a question' })
  async addQualityNote(
    @Param('id') id: string,
    @Body() dto: AddQuestionQualityNoteDto,
    @CurrentUser('sub') authorId: string,
  ) {
    return this.adminQuestionsBankService.addQualityNote(
      id,
      dto.note,
      authorId,
    );
  }

  @Get('questions/:id/quality-notes')
  @ApiOperation({ summary: 'List quality notes for a question' })
  async listQualityNotes(@Param('id') id: string) {
    return this.adminQuestionsBankService.listQualityNotes(id);
  }

  @Get('health-grid')
  @ApiOperation({
    summary:
      'Raw question counts per assessment_type/track/verified_level. No target capacity exists yet, so this returns counts only — no warning/critical percentage.',
  })
  async getHealthGrid() {
    return this.adminQuestionsBankService.getHealthGrid();
  }
}
