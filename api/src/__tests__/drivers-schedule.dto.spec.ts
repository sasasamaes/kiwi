// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateScheduleDto } from '../drivers/dto/update-schedule.dto';

// Mismas opciones que el ValidationPipe global (main.ts): whitelist +
// forbidNonWhitelisted. El cliente manda isAvailable y antes reventaba con
// "schedules.N.property isAvailable should not exist".
async function validateAsPipe(payload: unknown) {
  const dto = plainToInstance(UpdateScheduleDto, payload);
  return validate(dto, { whitelist: true, forbidNonWhitelisted: true });
}

describe('UpdateScheduleDto acepta isAvailable', () => {
  it('acepta bloques con isAvailable (lo que manda la app)', async () => {
    const errors = await validateAsPipe({
      schedules: [
        {
          dayOfWeek: 3,
          startTime: '2026-01-07T08:00:00.000Z',
          endTime: '2026-01-07T12:00:00.000Z',
          isAvailable: true,
        },
      ],
    });
    expect(errors).toHaveLength(0);
  });

  it('acepta lista vacía (limpiar horario)', async () => {
    const errors = await validateAsPipe({ schedules: [] });
    expect(errors).toHaveLength(0);
  });

  it('rechaza día inválido', async () => {
    const errors = await validateAsPipe({
      schedules: [
        {
          dayOfWeek: 9,
          startTime: '2026-01-07T08:00:00.000Z',
          endTime: '2026-01-07T12:00:00.000Z',
        },
      ],
    });
    expect(errors.length).toBeGreaterThan(0);
  });
});
