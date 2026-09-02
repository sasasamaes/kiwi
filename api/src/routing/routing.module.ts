import { Module } from '@nestjs/common';
import { RoutingService } from './routing.service';
import { RoutingController } from './routing.controller';
import { TrafficService } from './traffic.service';
import { TrafficAlertsService } from './traffic-alerts.service';
import { TrafficHistoryService } from './traffic-history.service';
import { RouteSuggestionsService } from './route-suggestions.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  providers: [
    RoutingService, 
    TrafficService, 
    TrafficAlertsService, 
    TrafficHistoryService,
    RouteSuggestionsService,
    PrismaService,
  ],
  controllers: [RoutingController],
  exports: [RoutingService, TrafficService, TrafficAlertsService, TrafficHistoryService, RouteSuggestionsService],
})
export class RoutingModule {}
