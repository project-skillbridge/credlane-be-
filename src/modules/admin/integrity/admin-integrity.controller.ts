import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AdminTiers } from '../../../common/decorators/admin-tiers.decorator';
import { AdminTier, UserRole } from '../../users/entities/user.entity';
import { AdminIntegrityService } from './admin-integrity.service';
import { ListVoidedAttemptsQueryDto } from './dto/list-voided-attempts-query.dto';

@ApiTags('admin-integrity')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@AdminTiers(AdminTier.SUPER_ADMIN, AdminTier.ADMIN, AdminTier.REVIEWER)
@Controller('admin/integrity')
export class AdminIntegrityController {
  constructor(private readonly adminIntegrityService: AdminIntegrityService) {}

  @Get('stats')
  @ApiOperation({
    summary:
      'Integrity stat cards: flagged/voided attempts, confidence, violation rate',
  })
  async getStats() {
    return this.adminIntegrityService.getStats();
  }

  @Get('voided-attempts')
  @ApiOperation({
    summary: 'List force-submitted (voided) assessment attempts',
  })
  async findVoidedAttempts(@Query() query: ListVoidedAttemptsQueryDto) {
    return this.adminIntegrityService.findVoidedAttempts(query);
  }
}
