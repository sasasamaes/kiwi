// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WithdrawalsService } from '../withdrawals/withdrawals.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('WithdrawalsService transiciones atómicas', () => {
  let service: WithdrawalsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      withdrawal: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WithdrawalsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: NotificationsService,
          useValue: { notifyWithdrawalStatus: jest.fn().mockResolvedValue({}) },
        },
      ],
    }).compile();

    service = module.get(WithdrawalsService);
  });

  const row = (status: string) => ({
    id: 'w1',
    status,
    amount: 5000,
    driver: { userId: 'driver-user-1' },
  });

  it('approve reclama pending una sola vez; el segundo intento falla', async () => {
    prisma.withdrawal.updateMany.mockResolvedValue({ count: 1 });
    prisma.withdrawal.findUnique.mockResolvedValue(row('processing'));

    const res = await service.approveWithdrawal('w1', 'admin-1');
    expect(res.status).toBe('processing');
    expect(prisma.withdrawal.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'w1', status: 'pending' } }),
    );

    // Segundo admin concurrente: nadie en pending → error, sin doble pago
    prisma.withdrawal.updateMany.mockResolvedValue({ count: 0 });
    prisma.withdrawal.findUnique.mockResolvedValue(row('processing'));
    await expect(service.approveWithdrawal('w1', 'admin-2')).rejects.toThrow(BadRequestException);
  });

  it('approve de inexistente da 404', async () => {
    prisma.withdrawal.updateMany.mockResolvedValue({ count: 0 });
    prisma.withdrawal.findUnique.mockResolvedValue(null);
    await expect(service.approveWithdrawal('w1', 'admin-1')).rejects.toThrow(NotFoundException);
  });

  it('complete solo sale de processing', async () => {
    prisma.withdrawal.updateMany.mockResolvedValue({ count: 1 });
    prisma.withdrawal.findUnique.mockResolvedValue(row('completed'));
    const res = await service.completeWithdrawal('w1', 'tx-1');
    expect(res.status).toBe('completed');

    prisma.withdrawal.updateMany.mockResolvedValue({ count: 0 });
    prisma.withdrawal.findUnique.mockResolvedValue(row('completed'));
    await expect(service.completeWithdrawal('w1', 'tx-2')).rejects.toThrow(BadRequestException);
  });

  it('reject solo sale de pending', async () => {
    prisma.withdrawal.updateMany.mockResolvedValue({ count: 1 });
    prisma.withdrawal.findUnique.mockResolvedValue(row('rejected'));
    const res = await service.rejectWithdrawal('w1', 'admin-1', 'motivo');
    expect(res.status).toBe('rejected');

    prisma.withdrawal.updateMany.mockResolvedValue({ count: 0 });
    prisma.withdrawal.findUnique.mockResolvedValue(row('processing'));
    await expect(service.rejectWithdrawal('w1', 'admin-1', 'x')).rejects.toThrow(
      BadRequestException,
    );
  });
});
