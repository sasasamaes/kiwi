import { render, fireEvent } from '@testing-library/react-native';
import { QtyStepper } from '../components/QtyStepper';

test('increments and decrements within bounds', () => {
  const onChange = jest.fn();
  const { getByLabelText } = render(<QtyStepper value={1} min={0} max={2} onChange={onChange} />);
  fireEvent.press(getByLabelText('aumentar'));
  expect(onChange).toHaveBeenCalledWith(2);
  fireEvent.press(getByLabelText('disminuir'));
  expect(onChange).toHaveBeenCalledWith(0);
});
