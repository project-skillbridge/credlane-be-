import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AdminTiers } from '../../../common/decorators/admin-tiers.decorator';
import { AdminTier, UserRole } from '../../users/entities/user.entity';
import { AdminQuestionsBankService } from './admin-questions-bank.service';
import { ListQuestionsQueryDto } from './dto/list-questions-query.dto';

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
}
