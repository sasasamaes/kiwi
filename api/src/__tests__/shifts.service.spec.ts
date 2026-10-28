// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Test, TestingModule } from '@nestjs/testing';
import { ShiftsService } from '../drivers/shifts.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

const CR = -6 * 3600 * 1000;
const atCRMinutes = (base: Date, mins: number) => {
  const cr = new Date(base.getTime() + CR);
  const dayStart = Date.UTC(cr.getUTCFullYear(), cr.getUTCMonth(), cr.getUTCDate());
  return new Date(dayStart + mins * 60_000 - CR);
};
const dowCR = (d: Date) => new Date(d.getTime() + CR).getUTCDay();
const minsCR = (d: Date) => {
  const cr = new Date(d.getTime() + CR);
  return cr.getUTCHours() * 60 + cr.getUTCMinutes();
};

describe('ShiftsService (horario propuesto)', () => {
  let service: ShiftsService;
  let prisma: any;
  let notify: jest.Mock;

  const driver = (schedules: any[]) => ({
    id: 'drv-1',
    userId: 'u1',
    fullName: 'Juan',
    schedules,
  });
  const block = (now: Date, startOff: number, endOff: number) => {
    const m = minsCR(now);
    return {
      dayOfWeek: dowCR(now),
      startTime: atCRMinutes(now, m + startOff),
      endTime: atCRMinutes(now, m + endOff),
    };
  };

  beforeEach(async () => {
    prisma = {
      driverProfile: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
      },
      order: { count: jest.fn().mockResolvedValue(0) },
    };
    notify = jest.fn().mockResolvedValue({});
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShiftsService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: { sendToUser: notify } },
      ],
    }).compile();
    service = module.get(ShiftsService);
  });

  it('dentro de horario no toca nada', async () => {
    const now = new Date();
    prisma.driverProfile.findMany.mockResolvedValue([driver([block(now, -30, 30)])]);
    const res = await service.enforceSchedules(now);
    expect(res).toEqual({ checked: 1, offed: 0, reminded: 0 });
    expect(prisma.driverProfile.update).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it('fuera de horario sin pedidos activos lo desconecta con aviso', async () => {
    const now = new Date();
    prisma.driverProfile.findMany.mockResolvedValue([driver([block(now, -120, -10)])]);
    prisma.order.count.mockResolvedValue(0);
    const res = await service.enforceSchedules(now);
    expect(res.offed).toBe(1);
    expect(prisma.driverProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'drv-1' } }),
    );
    expect(notify).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ data: expect.objectContaining({ type: 'shift_ended' }) }),
    );
  });

  it('fuera de horario con pedidos activos lo respeta (sin aviso antes de 60 min)', async () => {
    const now = new Date();
    prisma.driverProfile.findMany.mockResolvedValue([driver([block(now, -120, -30)])]);
    prisma.order.count.mockResolvedValue(2);
    const res = await service.enforceSchedules(now);
    expect(res).toEqual({ checked: 1, offed: 0, reminded: 0 });
    expect(prisma.driverProfile.update).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it('avisa una vez al cruzar 60 min fuera con pedidos activos', async () => {
    const now = new Date();
    prisma.driverProfile.findMany.mockResolvedValue([driver([block(now, -180, -62)])]);
    prisma.order.count.mockResolvedValue(1);
    const res = await service.enforceSchedules(now);
    expect(res.reminded).toBe(1);
    expect(notify).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ data: expect.objectContaining({ type: 'shift_reminder' }) }),
    );
  });

  it('después de la ventana de 60 min no spamea', async () => {
    const now = new Date();
    prisma.driverProfile.findMany.mockResolvedValue([driver([block(now, -300, -120)])]);
    prisma.order.count.mockResolvedValue(1);
    const res = await service.enforceSchedules(now);
    expect(res).toEqual({ checked: 1, offed: 0, reminded: 0 });
    expect(notify).not.toHaveBeenCalled();
  });

  it('respeta la gracia manual: no desconecta aunque esté fuera de horario', async () => {
    const now = new Date();
    prisma.driverProfile.findMany.mockResolvedValue([
      {
        id: 'drv-9',
        userId: 'u9',
        fullName: 'Luis',
        schedules: [],
        manualOnlineUntil: new Date(now.getTime() + 60 * 60 * 1000),
      },
    ]);
    const res = await service.enforceSchedules(now);
    expect(res).toEqual({ checked: 1, offed: 0, reminded: 0 });
    expect(prisma.driverProfile.update).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it('vencida la gracia vuelve a desconectar', async () => {
    const now = new Date();
    prisma.driverProfile.findMany.mockResolvedValue([
      {
        id: 'drv-9',
        userId: 'u9',
        fullName: 'Luis',
        schedules: [],
        manualOnlineUntil: new Date(now.getTime() - 1000),
      },
    ]);
    prisma.order.count.mockResolvedValue(0);
    const res = await service.enforceSchedules(now);
    expect(res.offed).toBe(1);
  });
});
