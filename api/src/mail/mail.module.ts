// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';

@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
