import { Global, Module } from '@nestjs/common';
import { FeatureFlagsService } from './feature-flags';

/** Global: cualquier módulo puede inyectar FeatureFlagsService. */
@Global()
@Module({
  providers: [FeatureFlagsService],
  exports: [FeatureFlagsService],
})
export class FeatureFlagsModule {}
