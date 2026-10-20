import { announceApi } from '../announce';

const fake = { get: jest.fn(), post: jest.fn() } as any;

test('followers GETs /merchants/me/followers', async () => {
  await announceApi(fake).followers();
  expect(fake.get).toHaveBeenCalledWith('/merchants/me/followers');
});

test('quota GETs /merchants/me/announce-quota', async () => {
  await announceApi(fake).quota();
  expect(fake.get).toHaveBeenCalledWith('/merchants/me/announce-quota');
});

test('send POSTs title and body', async () => {
  await announceApi(fake).send('Promo', '2x1 hoy');
  expect(fake.post).toHaveBeenCalledWith('/merchants/me/announce', {
    title: 'Promo',
    body: '2x1 hoy',
  });
});
