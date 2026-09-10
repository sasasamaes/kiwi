import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { TrafficNotificationService } from './traffic-notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { RoutingModule } from '../routing/routing.module';

@Module({
  imports: [RoutingModule],
  providers: [NotificationsService, TrafficNotificationService, PrismaService],
  controllers: [NotificationsController],
  exports: [NotificationsService, TrafficNotificationService],
})
export class NotificationsModule {}
