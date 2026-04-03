export type RootStackParamList = {
  Welcome: undefined;
  Home: undefined;
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
  LevelMap: undefined;
  AuthChoice: undefined;
  Game: {
    levelId: number;
    isDailyChallenge?: boolean;
    challengeType?: "speed" | "noHint" | "mystery";
  };
  Settings: undefined;
  ThemeStore: undefined;
  DailyChallenges: undefined;
  Tutorial: { fromGame?: boolean } | undefined;
};
