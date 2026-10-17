// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';

@Module({
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
