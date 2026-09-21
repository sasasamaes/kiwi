import { Controller, Get, Post, Put, Delete, Param, Query, UseGuards, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { TrafficNotificationService } from './traffic-notification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly trafficNotificationService: TrafficNotificationService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user notifications' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'unreadOnly', required: false })
  async getNotifications(
    @CurrentUser() user: any,
    @Query('limit') limit?: string,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.notificationsService.getUserNotifications(user.sub, {
      limit: limit ? Math.min(Math.max(parseInt(limit) || 50, 1), 100) : 50,
      unreadOnly: unreadOnly === 'true',
    });
  }

  @Get('unread-count')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get unread notification count' })
  async getUnreadCount(@CurrentUser() user: any) {
    const count = await this.notificationsService.getUnreadCount(user.sub);
    return { count };
  }

  @Put(':id/read')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark notification as read' })
  async markAsRead(@Param('id') id: string, @CurrentUser() user: any) {
    return this.notificationsService.markAsRead(id, user.sub);
  }

  @Put('read-all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllAsRead(@CurrentUser() user: any) {
    return this.notificationsService.markAllAsRead(user.sub);
  }

  @Delete('device-token')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a device token (logout/uninstall)' })
  async removeDeviceToken(@CurrentUser() user: any, @Body() body: { token: string }) {
    return this.notificationsService.removeDeviceToken(user.sub, body.token);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete notification' })
  async deleteNotification(@Param('id') id: string, @CurrentUser() user: any) {
    return this.notificationsService.deleteNotification(id, user.sub);
  }

  @Put('device-token')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register device token for push notifications' })
  async registerDeviceToken(
    @CurrentUser() user: any,
    @Body() body: { token: string; platform: 'ios' | 'android' | 'web' },
  ) {
    return this.notificationsService.registerDeviceToken(user.sub, body.token, body.platform);
  }

  // ============================================
  // 📡 TOPICS
  // ============================================

  @Get('topics')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Topic catalog with my effective preferences' })
  async getTopics(@CurrentUser() user: any) {
    return this.notificationsService.getTopicPreferences(user.sub);
  }

  @Put('topics/:topic')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enable/disable a topic and sync FCM subscriptions' })
  async setTopic(
    @CurrentUser() user: any,
    @Param('topic') topic: string,
    @Body() body: { enabled: boolean },
  ) {
    await this.notificationsService.setTopicPreference(user.sub, topic, body.enabled);
    return { success: true };
  }

  @Post('topics/sync')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Re-sync my FCM topic subscriptions from preferences' })
  async syncTopics(@CurrentUser() user: any) {
    return this.notificationsService.syncTopicSubscriptions(user.sub);
  }

  // ============================================
  // 🚦 TRAFFIC NOTIFICATIONS
  // ============================================

  @Get('traffic/history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get traffic notification history' })
  async getTrafficNotificationHistory(@CurrentUser() user: any, @Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit) : 20;
    return this.trafficNotificationService.getNotificationHistory(user.sub, limitNum);
  }

  @Get('traffic/preferences')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get traffic notification preferences' })
  async getTrafficPreferences(@CurrentUser() user: any) {
    return this.trafficNotificationService.getUserPreferences(user.sub);
  }

  @Put('traffic/preferences')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update traffic notification preferences' })
  async updateTrafficPreferences(
    @CurrentUser() user: any,
    @Body()
    body: {
      enabled?: boolean;
      types?: Record<string, boolean>;
      minConfidence?: number;
      trafficLevels?: string[];
      hours?: number[];
      days?: number[];
    },
  ) {
    await this.trafficNotificationService.updateUserPreferences(user.sub, body);
    return { success: true };
  }

  @Post('traffic/subscribe')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Subscribe to traffic predictions' })
  async subscribeToTrafficPredictions(
    @CurrentUser() user: any,
    @Body() body: { lat: number; lng: number },
  ) {
    await this.trafficNotificationService.sendPredictionNotification(user.sub, body.lat, body.lng);
    return { success: true };
  }

  @Post('traffic/test')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send test traffic notification' })
  async sendTestNotification(
    @CurrentUser() user: any,
    @Body() body: { lat: number; lng: number; type: string },
  ) {
    switch (body.type) {
      case 'prediction':
        await this.trafficNotificationService.sendPredictionNotification(
          user.sub,
          body.lat,
          body.lng,
        );
        break;
      case 'bestTime':
        await this.trafficNotificationService.sendBestTimeNotification(
          user.sub,
          body.lat,
          body.lng,
        );
        break;
      case 'peakHour':
        await this.trafficNotificationService.sendPeakHourWarning(user.sub, body.lat, body.lng);
        break;
      default:
        await this.trafficNotificationService.sendPredictionNotification(
          user.sub,
          body.lat,
          body.lng,
        );
    }
    return { success: true };
  }
}
