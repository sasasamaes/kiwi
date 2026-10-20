import { menuApi } from '../menu';

const fake = { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() } as any;

test('items GETs /menu/my', async () => {
  await menuApi(fake).items();
  expect(fake.get).toHaveBeenCalledWith('/menu/my');
});

test('create POSTs /menu/my', async () => {
  await menuApi(fake).create({ name: 'Casado', price: 3500 });
  expect(fake.post).toHaveBeenCalledWith('/menu/my', { name: 'Casado', price: 3500 });
});

test('update PUTs /menu/my/:id', async () => {
  await menuApi(fake).update('m1', { price: 4000 });
  expect(fake.put).toHaveBeenCalledWith('/menu/my/m1', { price: 4000 });
});

test('setAvailable PUTs isAvailable', async () => {
  await menuApi(fake).setAvailable('m1', false);
  expect(fake.put).toHaveBeenCalledWith('/menu/my/m1', { isAvailable: false });
});

test('remove DELETEs /menu/my/:id', async () => {
  await menuApi(fake).remove('m1');
  expect(fake.delete).toHaveBeenCalledWith('/menu/my/m1');
});

test('kiosks GETs /menu/my/kiosks', async () => {
  await menuApi(fake).kiosks();
  expect(fake.get).toHaveBeenCalledWith('/menu/my/kiosks');
});
