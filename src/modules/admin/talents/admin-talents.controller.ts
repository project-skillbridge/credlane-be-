import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminTiers } from '../../../common/decorators/admin-tiers.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AdminTier, UserRole } from '../../users/entities/user.entity';
import { AdminTalentsService } from './admin-talents.service';
import { ListTalentsQueryDto } from './dto/list-talents-query.dto';

@ApiTags('admin-talents')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@AdminTiers(AdminTier.SUPER_ADMIN, AdminTier.ADMIN)
@Controller('admin/talents')
export class AdminTalentsController {
  constructor(private readonly talentsService: AdminTalentsService) {}

  @Get()
  @ApiOperation({ summary: 'List candidates (read-only)' })
  async findAll(@Query() query: ListTalentsQueryDto) {
    const data = await this.talentsService.findAll(query);
    return { status: 'success', data };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Candidate detail panel' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.talentsService.findOne(id);
    return { status: 'success', data };
  }
}
