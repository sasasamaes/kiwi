// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Global, Module } from '@nestjs/common';
import { FeatureFlagsService } from './feature-flags';

/** Global: cualquier módulo puede inyectar FeatureFlagsService. */
@Global()
@Module({
  providers: [FeatureFlagsService],
  exports: [FeatureFlagsService],
})
export class FeatureFlagsModule {}
