// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MarketingService } from '../marketing/marketing.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';

/**
 * Difusión de ventas: resuelve destinatarios (base por rol + extras),
 * reemplaza {{name}}/{{registerUrl}} y registra el envío en el log.
 */
describe('MarketingService', () => {
  let service: MarketingService;
  let prisma: any;
  let mail: any;
  let wa: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma = {
      user: { findMany: jest.fn().mockResolvedValue([]) },
      broadcastLog: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    };
    mail = { sendMarketing: jest.fn().mockResolvedValue(true) };
    wa = {
      sendText: jest.fn().mockResolvedValue(true),
      sendTemplate: jest.fn(),
      templateFor: jest.fn().mockReturnValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketingService,
        { provide: PrismaService, useValue: prisma },
        { provide: MailService, useValue: mail },
        { provide: WhatsappService, useValue: wa },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(undefined) },
        },
      ],
    }).compile();

    service = module.get<MarketingService>(MarketingService);
  });

  it('manda a la base del rol + extras y guarda el log', async () => {
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'u1',
        email: 'a@x.com',
        phone: '8888-1111',
        role: 'merchant',
        merchantProfile: { businessName: 'Soda' },
      },
    ]);
    prisma.broadcastLog.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'log-1', ...data }),
    );

    const res = await service.send({
      channel: 'email',
      roles: ['merchant'],
      extraEmails: ['extra@x.com', 'mal'],
      subject: 'Hola',
      body: 'Hola {{name}}, entrá acá: {{registerUrl}}',
    });

    expect(res).toEqual({ sent: 2, failed: 0, logId: 'log-1' });
    expect(mail.sendMarketing).toHaveBeenCalledTimes(2);
    expect(mail.sendMarketing).toHaveBeenCalledWith(
      'a@x.com',
      'Hola',
      expect.stringContaining('Hola Soda'),
    );
    expect(prisma.broadcastLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        channel: 'email',
        audience: 'merchant',
        count: 2,
        failed: 0,
      }),
    });
  });

  it('dryRun cuenta sin enviar ni loguear', async () => {
    prisma.user.findMany.mockResolvedValue([{ id: 'u1', email: 'a@x.com', role: 'driver' }]);
    const res = await service.send({
      channel: 'whatsapp',
      roles: ['driver'],
      subject: 'x',
      body: 'y',
      dryRun: true,
    });
    expect(res).toEqual({ dryRun: true, count: 1 });
    expect(wa.sendText).not.toHaveBeenCalled();
    expect(prisma.broadcastLog.create).not.toHaveBeenCalled();
  });

  it('WhatsApp usa E.164 y cuenta fallos sin SMTP/Kapso', async () => {
    wa.sendText.mockResolvedValue(false);
    prisma.user.findMany.mockResolvedValue([{ id: 'u1', phone: '72199768', role: 'customer' }]);
    prisma.broadcastLog.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'log-2', ...data }),
    );
    const res = await service.send({
      channel: 'whatsapp',
      roles: ['customer'],
      subject: 's',
      body: 'b',
    });
    expect(wa.sendText).toHaveBeenCalledWith('50672199768', expect.any(String));
    expect(res).toEqual({ sent: 0, failed: 1, logId: 'log-2' });
  });
});
