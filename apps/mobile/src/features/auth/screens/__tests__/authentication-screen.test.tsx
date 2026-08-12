import { fireEvent, render } from '@testing-library/react-native';

import { AuthenticationScreen } from '../authentication-screen';

describe('AuthenticationScreen', () => {
  it('starts Google sign-in from the primary action', async () => {
    const onSignIn = jest.fn();

    const { getByRole } = await render(
      <AuthenticationScreen onSignIn={onSignIn} />,
    );
    fireEvent.press(getByRole('button', { name: 'Google로 계속하기' }));

    expect(onSignIn).toHaveBeenCalledTimes(1);
  });

  it('explains an owner mismatch without offering unsafe direct access', async () => {
    const { getByText } = await render(
      <AuthenticationScreen onSignIn={jest.fn()} ownerMismatch />,
    );

    expect(getByText('다른 계정의 로컬 데이터입니다')).toBeOnTheScreen();
    expect(getByText(/처음 연결한 Google 계정/)).toBeOnTheScreen();
  });
});
