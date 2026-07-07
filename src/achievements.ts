import type { HardcoreScores } from './HardcoreMode';

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
}

export interface AchievementProgressInput {
  gamesPlayed: number;
  bestAccuracy: number | null;
  spotOns: number;
  clockRating: number;
  dailyChallengesCompleted: number;
  dailyStreak: number;
  bestLadderLevel: number;
  hardcoreScores: HardcoreScores;
}

export const achievementDefinitions: AchievementDefinition[] = [
  {
    id: 'first_guess',
    title: 'First Tick',
    description: 'Complete your first Time Guesser round.',
  },
  {
    id: 'sharp_clock',
    title: 'Sharp Clock',
    description: 'Finish within 0.10 seconds in any tracked guess.',
  },
  {
    id: 'quarter_second',
    title: 'Quarter Sense',
    description: 'Finish within 0.25 seconds in any tracked guess.',
  },
  {
    id: 'spot_on',
    title: 'Spot On',
    description: 'Hit a perfect 0.00 second error.',
  },
  {
    id: 'ten_guesses',
    title: 'Warming Up',
    description: 'Complete 10 tracked Time Guesser rounds.',
  },
  {
    id: 'daily_starter',
    title: 'Daily Habit',
    description: 'Complete a Daily Challenge.',
  },
  {
    id: 'three_day_streak',
    title: 'Clocking In',
    description: 'Reach a 3 day Daily Challenge streak.',
  },
  {
    id: 'week_streak',
    title: 'One Week Hot',
    description: 'Reach a 7 day Daily Challenge streak.',
  },
  {
    id: 'daily_ten',
    title: 'Regular Ritual',
    description: 'Complete 10 Daily Challenges.',
  },
  {
    id: 'ladder_5',
    title: 'Getting Higher',
    description: 'Clear Level 5 in Time Ladder.',
  },
  {
    id: 'ladder_10',
    title: 'Halfway Up',
    description: 'Clear Level 10 in Time Ladder.',
  },
  {
    id: 'ladder_complete',
    title: 'Top of Time',
    description: 'Complete the full 20 level Time Ladder.',
  },
  {
    id: 'hardcore_unlock',
    title: 'New Pressure',
    description: 'Unlock your first extra Hardcore difficulty.',
  },
  {
    id: 'hardcore_10',
    title: 'Ten Lives Later',
    description: 'Score 10 in any Hardcore difficulty.',
  },
  {
    id: 'hardcore_god',
    title: '???',
    description: 'Unlock the hidden Hardcore tier.',
  },
  {
    id: 'silver_clock',
    title: 'Silver Timing',
    description: 'Reach Silver Clock in Ranked Time Guesser.',
  },
  {
    id: 'chrono_master',
    title: 'Chrono Master',
    description: 'Reach the final Clock Rating rank.',
  },
];

export function getUnlockedAchievementIds(progress: AchievementProgressInput) {
  const unlocked = new Set<string>();
  const bestHardcoreScore = Math.max(
    progress.hardcoreScores.easy,
    progress.hardcoreScores.medium,
    progress.hardcoreScores.hard,
    progress.hardcoreScores.expert,
    progress.hardcoreScores.god,
    progress.hardcoreScores.literal
  );

  if (progress.gamesPlayed >= 1) unlocked.add('first_guess');
  if (progress.gamesPlayed >= 10) unlocked.add('ten_guesses');
  if (progress.bestAccuracy !== null && progress.bestAccuracy <= 0.1) unlocked.add('sharp_clock');
  if (progress.bestAccuracy !== null && progress.bestAccuracy <= 0.25) unlocked.add('quarter_second');
  if (progress.spotOns >= 1) unlocked.add('spot_on');
  if (progress.dailyChallengesCompleted >= 1) unlocked.add('daily_starter');
  if (progress.dailyChallengesCompleted >= 10) unlocked.add('daily_ten');
  if (progress.dailyStreak >= 3) unlocked.add('three_day_streak');
  if (progress.dailyStreak >= 7) unlocked.add('week_streak');
  if (progress.bestLadderLevel >= 5) unlocked.add('ladder_5');
  if (progress.bestLadderLevel >= 10) unlocked.add('ladder_10');
  if (progress.bestLadderLevel >= 20) unlocked.add('ladder_complete');
  if (progress.hardcoreScores.easy >= 3 || progress.hardcoreScores.medium > 0 || progress.hardcoreScores.hard > 0 || progress.hardcoreScores.expert > 0 || progress.hardcoreScores.god > 0 || progress.hardcoreScores.literal > 0) {
    unlocked.add('hardcore_unlock');
  }
  if (bestHardcoreScore >= 10) unlocked.add('hardcore_10');
  if (progress.hardcoreScores.expert >= 3 || progress.hardcoreScores.god > 0 || progress.hardcoreScores.literal > 0) {
    unlocked.add('hardcore_god');
  }
  if (progress.clockRating >= 200) unlocked.add('silver_clock');
  if (progress.clockRating >= 3000) unlocked.add('chrono_master');

  return unlocked;
}
