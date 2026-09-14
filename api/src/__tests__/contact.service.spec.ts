import { Test } from '@nestjs/testing';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ContactService } from '../contact/contact.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContactMessageDto } from '../contact/dto/create-contact-message.dto';

/**
 * Valida el contrato del formulario de contacto: el DTO (con Transform de
 * trim) contra un ValidationPipe real, y las reglas del service.
 */
describe('Contact validation', () => {
  let service: ContactService;
  let prisma: { contactMessage: { findFirst: jest.Mock; create: jest.Mock } };
  let pipe: ValidationPipe;

  const validate = async (body: Record<string, unknown>) => {
    const dto = plainToInstance(CreateContactMessageDto, body);
    return pipe.transform(dto, { type: 'body', metatype: CreateContactMessageDto });
  };

  // class-transformer sin decoradores de transform explícitos en el test:
  const { plainToInstance } = require('class-transformer');

  beforeEach(async () => {
    prisma = {
      contactMessage: { findFirst: jest.fn(), create: jest.fn() },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [ContactService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(ContactService);
    pipe = new ValidationPipe({ whitelist: true, transform: true });
    jest.clearAllMocks();
  });

  it('acepta un mensaje válido con email', async () => {
    const dto = (await validate({
      name: 'Ana',
      email: ' a@b.co ',
      subject: 'merchant',
      message: '  quiero registrar mi comercio  ',
    })) as CreateContactMessageDto;

    prisma.contactMessage.findFirst.mockResolvedValue(null);
    prisma.contactMessage.create.mockResolvedValue({ id: 'x', createdAt: new Date() });

    const result = await service.create(dto);
    expect(result.ok).toBe(true);
    // trim llegó al service vía el Transform del DTO
    expect(prisma.contactMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Ana', email: 'a@b.co' }),
      }),
    );
  });

  it('rechaza name de solo espacios (trim antes de validar)', async () => {
    await expect(
      validate({
        name: '   ',
        email: 'a@b.co',
        subject: 'general',
        message: 'texto suficientemente largo',
      }),
    ).rejects.toThrow();
  });

  it('rechaza message de solo espacios aunque tenga 10+ caracteres', async () => {
    await expect(
      validate({ name: 'Ana', email: 'a@b.co', subject: 'general', message: '          ' }),
    ).rejects.toThrow();
  });

  it('rechaza email sin TLD', async () => {
    await expect(
      validate({
        name: 'Ana',
        email: 'a@b',
        subject: 'general',
        message: 'texto suficientemente largo',
      }),
    ).rejects.toThrow();
  });

  it('acepta email pegado con espacios (trim lo arregla)', async () => {
    const dto = (await validate({
      name: 'Ana',
      email: '  ana@kiwi.app  ',
      subject: 'general',
      message: 'texto suficientemente largo',
    })) as CreateContactMessageDto;
    expect(dto.email).toBe('ana@kiwi.app');
  });

  it('rechaza phone con letras', async () => {
    await expect(
      validate({
        name: 'Ana',
        phone: '8888-ABCD',
        subject: 'general',
        message: 'texto suficientemente largo',
      }),
    ).rejects.toThrow();
  });

  it('rechaza subject fuera del enum', async () => {
    await expect(
      validate({
        name: 'Ana',
        email: 'a@b.co',
        subject: 'hack',
        message: 'texto suficientemente largo',
      }),
    ).rejects.toThrow();
  });

  it('service: sin email ni phone → 400', async () => {
    const dto = (await validate({
      name: 'Ana',
      subject: 'general',
      message: 'texto suficientemente largo',
    })) as CreateContactMessageDto;
    await expect(service.create(dto)).rejects.toThrow(BadRequestException);
  });

  it('service: dedupe de mensaje idéntico reciente', async () => {
    const dto = (await validate({
      name: 'Ana',
      email: 'a@b.co',
      subject: 'general',
      message: 'texto suficientemente largo',
    })) as CreateContactMessageDto;

    prisma.contactMessage.findFirst.mockResolvedValue({ id: 'prev' });
    const result = await service.create(dto);
    expect(result).toEqual({ ok: true, duplicate: true });
    expect(prisma.contactMessage.create).not.toHaveBeenCalled();
  });
});
