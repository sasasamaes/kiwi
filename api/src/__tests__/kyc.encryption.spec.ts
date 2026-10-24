// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Test, TestingModule } from '@nestjs/testing';
import { KYCService } from '../kyc/kyc.service';
import { DiditProvider } from '../kyc/didit.provider';
import { PrismaService } from '../prisma/prisma.service';
import { FieldCipher } from '../security/field-cipher';

describe('KYCService — cifrado de números de identidad en reposo', () => {
  let service: KYCService;
  let prisma: any;
  let cipher: FieldCipher;

  beforeEach(async () => {
    process.env.KYC_FIELD_ENCRYPTION_KEY = Buffer.alloc(32, 5).toString('base64');

    prisma = {
      kYCVerification: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KYCService,
        DiditProvider,
        { provide: PrismaService, useValue: prisma },
        FieldCipher,
      ],
    }).compile();

    service = module.get<KYCService>(KYCService);
    cipher = module.get<FieldCipher>(FieldCipher);
    prisma.$transaction = jest.fn();
  });

  it('submitDocuments guarda idNumber cifrado, nunca en claro', async () => {
    prisma.kYCVerification.findUnique.mockResolvedValue(null);
    prisma.kYCVerification.create.mockImplementation(async ({ data }) => data);

    await service.submitDocuments('u-1', {
      idNumber: '209880065',
      idType: 'cedula',
      idFrontUrl: 'https://cdn.example.com/id.jpg',
      selfieUrl: 'https://cdn.example.com/selfie.jpg',
      businessLicenseUrl: 'https://cdn.example.com/license.jpg',
    });

    const stored = prisma.kYCVerification.create.mock.calls[0][0].data;
    expect(stored.idNumber).toMatch(/^v1:/);
    expect(stored.idNumber).not.toContain('209880065');
    expect(stored.idType).toBe('cedula'); // campo no sensible queda intacto
  });

  it('rechaza envíos sin documentos (nunca crea una revisión vacía)', async () => {
    await expect(
      service.submitDocuments('u-1', { idNumber: '209880065', idType: 'cedula' }),
    ).rejects.toThrow('Faltan las fotos');
    expect(prisma.kYCVerification.create).not.toHaveBeenCalled();
  });

  it('rechaza URLs truthy no-https, aunque el campo venga relleno', async () => {
    await expect(
      service.submitDocuments('u-1', {
        idFrontUrl: 'javascript:alert(1)',
        selfieUrl: 'http://insecure.example.com/selfie.jpg',
        businessLicenseUrl: 'https://cdn.example.com/license.jpg',
      }),
    ).rejects.toThrow('Faltan las fotos');
    expect(prisma.kYCVerification.create).not.toHaveBeenCalled();
  });

  it('getVerificationByUserId (dueño) recibe el número enmascarado por defecto', async () => {
    prisma.kYCVerification.findUnique.mockResolvedValue({
      idNumber: cipher.encrypt('209880065'),
    });

    const row = await service.getVerificationByUserId('u-1');
    expect(row.idNumber).toBe('••••0065');
  });

  it('detalle de revisión admin recibe el número completo', async () => {
    prisma.kYCVerification.findUnique.mockResolvedValue({
      idNumber: cipher.encrypt('209880065'),
    });

    const row = await service.getVerificationById('v-1');
    expect(row.idNumber).toBe('209880065');
  });

  it('getVerificationByUserId por defecto enmascara (solo últimos 4)', async () => {
    prisma.kYCVerification.findUnique.mockResolvedValue({
      idNumber: cipher.encrypt('209880065'),
    });

    const row = await service.getVerificationByUserId('u-1', { maskIdentity: true });
    expect(row.idNumber).toBe('••••0065');
  });

  it('filas legacy en texto plano se enmascaran al leer y nunca se devuelven en claro', async () => {
    prisma.kYCVerification.findUnique.mockResolvedValue({ idNumber: '209880065' });

    const row = await service.getVerificationByUserId('u-1');
    expect(row.idNumber).toBe('••••0065');
  });

  it('listas admin devuelven el valor enmascarado', async () => {
    prisma.kYCVerification.findMany.mockResolvedValue([{ idNumber: cipher.encrypt('1234567890') }]);

    const rows = await service.getAllVerifications();
    expect(rows[0].idNumber).toBe('••••7890');
  });

  it('listas admin incluyen la relación user (regresión: el panel admin leía kyc.user.role)', async () => {
    prisma.kYCVerification.findMany.mockResolvedValue([
      {
        id: 'v-1',
        status: 'pending',
        user: { id: 'u-1', email: 'a@b.c', phone: '8888', role: 'driver' },
      },
    ]);

    const rows = await service.getAllVerifications();
    expect(prisma.kYCVerification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: { user: expect.objectContaining({ select: expect.anything() }) },
      }),
    );
    expect(rows[0].user.role).toBe('driver');
  });

  it('production sin KYC_FIELD_ENCRYPTION_KEY no arranca', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.KYC_FIELD_ENCRYPTION_KEY;

    expect(() => new FieldCipher()).toThrow('KYC_FIELD_ENCRYPTION_KEY');
    process.env.NODE_ENV = 'test';
  });
});
