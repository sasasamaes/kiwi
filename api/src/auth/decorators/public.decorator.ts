// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks an endpoint as public: the global JwtAuthGuard skips authentication.
 * Use sparingly — every @Public() route is an intentional hole in the
 * default-deny posture (register/login, share-link tracking, public menus,
 * payment webhooks, the liveness probe).
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
