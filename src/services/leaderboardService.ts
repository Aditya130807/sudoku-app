export interface LeaderboardEntry {
  rank: number;
  name: string;
  stars: number;
  bestStreak: number;
}

const previewLeaderboard: LeaderboardEntry[] = [
  { rank: 1, name: "Ava", stars: 76, bestStreak: 18 },
  { rank: 2, name: "Noah", stars: 72, bestStreak: 16 },
  { rank: 3, name: "Ira", stars: 69, bestStreak: 15 },
];

export const leaderboardService = {
  async getWeeklyPreview(): Promise<LeaderboardEntry[]> {
    return previewLeaderboard;
  },
};
