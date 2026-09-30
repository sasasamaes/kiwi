// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { RegisterDto } from '../auth/dto/register.dto';

/**
 * Contrato de validación del registro contra un ValidationPipe real (mismo
 * setup que main.ts): el teléfono llega en la forma en que el usuario lo
 * escribe y sale en la forma canónica 8888-8888, o falla con el mensaje de
 * siempre.
 */
describe('RegisterDto: phone', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  const validate = async (phone: unknown) => {
    const dto = plainToInstance(RegisterDto, {
      email: 'user@kiwi.com',
      password: 'password123',
      role: 'driver',
      fullName: 'Ana Solís',
      phone,
    });
    return (await pipe.transform(dto, {
      type: 'body',
      metatype: RegisterDto,
    })) as RegisterDto;
  };

  it.each([
    ['+506 7219 9768', '7219-9768'],
    ['+50672199768', '7219-9768'],
    ['+506-7219-9768', '7219-9768'],
    ['72199768', '7219-9768'],
    ['7219 9768', '7219-9768'],
    ['7219-9768', '7219-9768'],
    ['  7219-9768  ', '7219-9768'],
  ])('normaliza "%s" a "%s"', async (input, expected) => {
    const dto = await validate(input);
    expect(dto.phone).toBe(expected);
  });

  it('acepta el campo vacío (opcional)', async () => {
    const dto = await validate('');
    expect(dto.phone).toBeUndefined();
  });

  // ValidationPipe envuelve las violaciones en un BadRequestException cuyo
  // mensaje amigable vive en getResponse(), no en .message.
  const expectInvalidPhone = async (input: unknown) => {
    const error = await validate(input).catch((e) => e);
    expect(error).toBeInstanceOf(BadRequestException);
    expect(JSON.stringify(error.getResponse())).toContain('Formato de teléfono inválido');
  };

  it('rechaza un número incompleto con el mensaje de siempre', async () => {
    await expectInvalidPhone('7219');
  });

  it('rechaza letras', async () => {
    await expectInvalidPhone('8888-ABCD');
  });

  it('rechaza un número con más de 8 dígitos (no costarricense)', async () => {
    await expectInvalidPhone('+1 555 123 4567');
  });
});
