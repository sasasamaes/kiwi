import { parseReturnUrl } from '../returnLink';

test('detects success and orderId', () => {
  expect(
    parseReturnUrl('kiwicliente://payment/return?status=success&orderId=o1', 'kiwicliente'),
  ).toEqual({ status: 'success', orderId: 'o1' });
});

test('detects cancel', () => {
  expect(parseReturnUrl('kiwicliente://payment/return?status=cancel', 'kiwicliente').status).toBe(
    'cancel',
  );
});

test('unknown on foreign url', () => {
  expect(parseReturnUrl('https://x/y', 'kiwicliente').status).toBe('unknown');
});

test('unknown on malformed url', () => {
  expect(parseReturnUrl('not a url', 'kiwicliente').status).toBe('unknown');
});

test('success without orderId omits it', () => {
  expect(parseReturnUrl('kiwicliente://payment/return?status=success', 'kiwicliente')).toEqual({
    status: 'success',
  });
});
