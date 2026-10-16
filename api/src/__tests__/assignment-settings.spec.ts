import { SettingsService } from '../settings/settings.service';

function serviceWith(rows: any[]) {
  const prisma: any = { platformSetting: { findMany: jest.fn().mockResolvedValue(rows) } };
  const config: any = { get: jest.fn().mockReturnValue(undefined) };
  return new SettingsService(prisma, config);
}

it('defaults 5 y 10 sin filas', async () => {
  const res = await serviceWith([]).getAssignmentTimeouts();
  expect(res).toEqual({ acceptanceMinutes: 5, contestMinutes: 10 });
});

it('respeta valores guardados y sanea a 1..60', async () => {
  const svc = serviceWith([
    { key: 'assignment', value: { acceptanceMinutes: 3, contestMinutes: 99 } },
  ]);
  const res = await svc.getAssignmentTimeouts();
  expect(res).toEqual({ acceptanceMinutes: 3, contestMinutes: 60 });
});
