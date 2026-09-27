// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
