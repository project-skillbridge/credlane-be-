import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdminTiers } from '../../../common/decorators/admin-tiers.decorator';
import type { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AdminTier, UserRole } from '../../users/entities/user.entity';
import { AdminAdminsService } from './admin-admins.service';
import { ChangeAdminEmailDto } from './dto/change-admin-email.dto';
import { ChangeAdminRoleDto } from './dto/change-admin-role.dto';
import { InviteAdminDto } from './dto/invite-admin.dto';
import { ListAdminsQueryDto } from './dto/list-admins-query.dto';

@ApiTags('admin-admins')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@AdminTiers(AdminTier.SUPER_ADMIN)
@Controller('admin/admins')
export class AdminAdminsController {
  constructor(private readonly adminsService: AdminAdminsService) {}

  @Get()
  @ApiOperation({ summary: 'List admin dashboard accounts (paginated)' })
  @ApiOkResponse({ description: 'Paginated admin accounts' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'User is not a SUPER_ADMIN admin' })
  async findAll(@Query() query: ListAdminsQueryDto) {
    const data = await this.adminsService.findAll(query);
    return { status: 'success', data };
  }

  @Post('invite')
  @ApiOperation({
    summary:
      'Invite a new admin (creates Pending Setup account + sends setup email)',
  })
  @ApiOkResponse({ description: 'Invite queued' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'User is not a SUPER_ADMIN admin' })
  async invite(
    @Body() dto: InviteAdminDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    const data = await this.adminsService.invite(dto, actor.sub);
    return { status: 'success', message: data.message, data: data.account };
  }

  @Post(':id/reset-password')
  @ApiOperation({ summary: 'Send a password reset/setup code to an admin' })
  @ApiOkResponse({ description: 'Reset email queued' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'User is not a SUPER_ADMIN admin' })
  async resetPassword(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.adminsService.resetPassword(id);
    return { status: 'success', message: data.message };
  }

  @Patch(':id/email')
  @ApiOperation({ summary: 'Change an admin account email (audit logged)' })
  @ApiOkResponse({ description: 'Email updated' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'User is not a SUPER_ADMIN admin' })
  async changeEmail(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeAdminEmailDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    const data = await this.adminsService.changeEmail(id, dto, actor.sub);
    return { status: 'success', message: data.message, data: data.account };
  }

  @Patch(':id/role')
  @ApiOperation({ summary: 'Change an admin tier (takes effect immediately)' })
  @ApiOkResponse({ description: 'Role updated' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'User is not a SUPER_ADMIN admin' })
  async changeRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeAdminRoleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    const data = await this.adminsService.changeRole(id, dto, actor.sub);
    return { status: 'success', message: data.message, data: data.account };
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate an admin account' })
  @ApiOkResponse({ description: 'Account deactivated' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'User is not a SUPER_ADMIN admin' })
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    const data = await this.adminsService.deactivate(id, actor.sub);
    return { status: 'success', message: data.message, data: data.account };
  }

  @Patch(':id/reactivate')
  @ApiOperation({ summary: 'Reactivate a deactivated admin account' })
  @ApiOkResponse({ description: 'Account reactivated' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'User is not a SUPER_ADMIN admin' })
  async reactivate(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.adminsService.reactivate(id);
    return { status: 'success', message: data.message, data: data.account };
  }
}
