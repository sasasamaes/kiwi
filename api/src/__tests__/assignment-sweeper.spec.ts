// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { AssignmentSweeper } from '../orders/assignment-sweeper.service';

function buildPrisma() {
  return {
    order: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
    orderEvent: {
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
}

/**
 * findMany por fases: las lecturas de barrido devuelven las listas en orden;
 * las lecturas loteadas (where.id.in) devuelven las filas completas con merchant.
 */
function phaseFindMany(prisma: any, phases: any[][], full: (id: string) => any = (id) => ({ id })) {
  const queue = [...phases];
  prisma.order.findMany.mockImplementation(async ({ where }: any) => {
    if (where?.id?.in) return (where.id.in as string[]).map(full);
    return queue.shift() ?? [];
  });
}

function buildSweeper(prisma: any) {
  const settings = { getAssignmentTimeouts: jest.fn().mockResolvedValue({ contestMinutes: 5 }) };
  const events = { sendToUser: jest.fn() };
  const notifications = {
    notifyContestStarted: jest.fn().mockResolvedValue(undefined),
    notifyNoDriverAvailable: jest.fn().mockResolvedValue(undefined),
  };
  const orders = { alertNearbyDrivers: jest.fn().mockResolvedValue(undefined) };
  const sweeper = new AssignmentSweeper(
    prisma as any,
    settings as any,
    events as any,
    notifications as any,
    orders as any,
  );
  return { sweeper, settings, events, notifications, orders };
}

describe('AssignmentSweeper (batches)', () => {
  it('aceptaciones vencidas: 1 createMany para los eventos, notifica a cada ganador', async () => {
    const prisma = buildPrisma();
    phaseFindMany(
      prisma,
      [
        [
          { id: 'o1', driverId: 'd1', merchantId: 'm1' },
          { id: 'o2', driverId: 'd2', merchantId: 'm2' },
        ], // acceptance expired
        [], // contests
        [], // unpaid
      ],
      (id: string) => ({
        id,
        pickupAddress: 'A',
        deliveryAddress: 'B',
        totalAmount: 1000,
        distanceKm: 1,
        merchant: { userId: `u-${id}`, businessName: 'Soda' },
      }),
    );
    prisma.order.updateMany.mockResolvedValue({ count: 1 });
    const { sweeper, notifications, orders } = buildSweeper(prisma);

    const res = await sweeper.sweepOnce();

    expect(res.acceptanceExpired).toBe(2);
    // Un solo round-trip para los 4 eventos (2 por pedido), no 4 creates.
    expect(prisma.orderEvent.createMany).toHaveBeenCalledTimes(1);
    expect(prisma.orderEvent.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ orderId: 'o1', type: 'acceptance_expired' }),
        expect.objectContaining({ orderId: 'o1', type: 'contest_started' }),
        expect.objectContaining({ orderId: 'o2', type: 'acceptance_expired' }),
        expect.objectContaining({ orderId: 'o2', type: 'contest_started' }),
      ]),
    });
    expect(notifications.notifyContestStarted).toHaveBeenCalledTimes(2);
    expect(orders.alertNearbyDrivers).toHaveBeenCalledTimes(2);
  });

  it('el claim perdido (otra instancia ganó) no genera eventos ni notifica', async () => {
    const prisma = buildPrisma();
    phaseFindMany(prisma, [[{ id: 'o1', driverId: 'd1', merchantId: 'm1' }], [], []]);
    prisma.order.updateMany.mockResolvedValue({ count: 0 });
    const { sweeper, notifications } = buildSweeper(prisma);

    const res = await sweeper.sweepOnce();

    expect(res.acceptanceExpired).toBe(0);
    expect(prisma.orderEvent.createMany).not.toHaveBeenCalled();
    expect(notifications.notifyContestStarted).not.toHaveBeenCalled();
  });

  it('concursos vencidos y pagos abandonados también lotean sus eventos', async () => {
    const prisma = buildPrisma();
    phaseFindMany(prisma, [[], [{ id: 'c1' }], [{ id: 'p1' }]], (id: string) => ({
      id,
      merchant: { userId: `u-${id}` },
    }));
    prisma.order.updateMany.mockResolvedValue({ count: 1 });
    const { sweeper } = buildSweeper(prisma);

    const res = await sweeper.sweepOnce();

    expect(res.contestsExpired).toBe(1);
    expect(res.paymentExpired).toBe(1);
    // 2 eventos del concurso + 1 del pago, en 2 createMany (uno por fase).
    expect(prisma.orderEvent.createMany).toHaveBeenCalledTimes(2);
  });
});
