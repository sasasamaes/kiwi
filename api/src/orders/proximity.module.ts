import { Module } from '@nestjs/common';
import { ProximityService } from './proximity.service';

@Module({
  providers: [ProximityService],
  exports: [ProximityService],
})
export class ProximityModule {}
