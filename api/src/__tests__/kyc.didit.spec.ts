// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { KYCService } from '../kyc/kyc.service';
import { DiditProvider } from '../kyc/didit.provider';
import { PrismaService } from '../prisma/prisma.service';
import { FieldCipher } from '../security/field-cipher';

describe('KYCService — errores de Didit mapeados a 503 (no 500 crudo)', () => {
  let service: KYCService;
  let prisma: any;
  let didit: any;

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn() },
      kYCVerification: {
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
    };
    didit = {
      isConfigured: jest.fn().mockReturnValue(true),
      createSession: jest.fn(),
      getDecision: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KYCService,
        { provide: PrismaService, useValue: prisma },
        { provide: FieldCipher, useValue: {} },
        { provide: DiditProvider, useValue: didit },
      ],
    }).compile();

    service = module.get(KYCService);
  });

  it('startDiditSession: fallo de Didit → 503 reintentable, no 500', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u-1', email: 'a@x.com', phone: null });
    prisma.kYCVerification.findUnique.mockResolvedValue(null);
    didit.createSession.mockRejectedValue(new Error('Didit rechazó la API key (401/403)'));

    await expect(service.startDiditSession('u-1')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await expect(service.startDiditSession('u-1')).rejects.toThrow(
      'Intentá de nuevo en unos minutos',
    );
  });

  it('startDiditSession: camino feliz devuelve url y guarda la sesión', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u-1', email: null, phone: null });
    prisma.kYCVerification.findUnique.mockResolvedValue(null);
    didit.createSession.mockResolvedValue({
      session_id: 's-1',
      url: 'https://x.didit.me/s-1',
      status: 'created',
    });
    prisma.kYCVerification.create.mockResolvedValue({ id: 'v-1' });

    const res = await service.startDiditSession('u-1');
    expect(res).toMatchObject({ url: 'https://x.didit.me/s-1', sessionId: 's-1' });
  });

  it('startDiditSession: sin configurar → 400 (comportamiento previo intacto)', async () => {
    didit.isConfigured.mockReturnValue(false);
    await expect(service.startDiditSession('u-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refreshDiditSession: fallo de Didit → 503', async () => {
    prisma.kYCVerification.findUnique.mockResolvedValue({ id: 'v-1', diditSessionId: 's-1' });
    didit.getDecision.mockRejectedValue(new Error('boom'));

    await expect(service.refreshDiditSession('u-1')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
