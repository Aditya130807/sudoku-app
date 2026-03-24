export type RootStackParamList = {
  Welcome: undefined;
  Home: undefined;
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
  LevelMap: undefined;
  AuthChoice: undefined;
  Game: { levelId: number };
  Settings: undefined;
  Tutorial: { fromGame?: boolean } | undefined;
};
