import { render } from '@testing-library/react-native';

import { HomeScreen } from '../home-screen';

describe('HomeScreen', () => {
  it('shows that the development harness is ready', async () => {
    const { getByText } = await render(<HomeScreen />);

    expect(getByText('하네스 구성 완료')).toBeOnTheScreen();
  });
});
