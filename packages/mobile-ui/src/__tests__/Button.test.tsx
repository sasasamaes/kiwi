import { render, fireEvent } from '@testing-library/react-native';
import { Button } from '../components/Button';

test('calls onPress when pressed', () => {
  const onPress = jest.fn();
  const { getByText } = render(<Button label="Aceptar" onPress={onPress} />);
  fireEvent.press(getByText('Aceptar'));
  expect(onPress).toHaveBeenCalledTimes(1);
});

test('does not fire while loading', () => {
  // When loading, the label is replaced by an ActivityIndicator, so query the
  // button by its accessibility role instead of by its text.
  const onPress = jest.fn();
  const { getByRole } = render(<Button label="Aceptar" onPress={onPress} loading />);
  fireEvent.press(getByRole('button'));
  expect(onPress).not.toHaveBeenCalled();
});
