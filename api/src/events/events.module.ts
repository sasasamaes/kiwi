// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Module } from '@nestjs/common';
import { EventsGateway } from './events.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [PrismaModule, AuthModule, ChatModule],
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class EventsModule {}
