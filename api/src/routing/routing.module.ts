import { Module } from '@nestjs/common';
import { RoutingService } from './routing.service';
import { RoutingController } from './routing.controller';
import { TrafficService } from './traffic.service';

@Module({
  providers: [RoutingService, TrafficService],
  controllers: [RoutingController],
  exports: [RoutingService, TrafficService],
})
export class RoutingModule {}
