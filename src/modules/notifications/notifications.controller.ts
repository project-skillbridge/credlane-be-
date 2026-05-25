import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import {
  ListNotificationsQueryDto,
  NotificationsListResponseDto,
  UnreadCountResponseDto,
} from './dto/notification.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiCookieAuth()
@Controller('talent/notifications')
@Roles(UserRole.TALENT)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List in-app notifications for the current talent' })
  @ApiOkResponse({ type: NotificationsListResponseDto })
  async list(
    @CurrentUser('sub') userId: string,
    @Query() query: ListNotificationsQueryDto,
  ): Promise<NotificationsListResponseDto> {
    const items = await this.notificationsService.listForUser(
      userId,
      query.limit,
    );
    return { items };
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread in-app notification count' })
  @ApiOkResponse({ type: UnreadCountResponseDto })
  async unreadCount(
    @CurrentUser('sub') userId: string,
  ): Promise<UnreadCountResponseDto> {
    const unreadCount = await this.notificationsService.countUnread(userId);
    return { unread_count: unreadCount };
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiOkResponse({ description: 'All notifications marked as read' })
  async markAllAsRead(@CurrentUser('sub') userId: string): Promise<void> {
    await this.notificationsService.markAllAsRead(userId);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiNotFoundResponse({ description: 'Notification not found' })
  @ApiOkResponse({ description: 'Notification marked as read' })
  async markAsRead(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) notificationId: string,
  ): Promise<void> {
    await this.notificationsService.markAsRead(userId, notificationId);
  }
}
