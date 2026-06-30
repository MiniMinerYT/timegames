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
    id: 'spot_on',
    title: 'Spot On',
    description: 'Hit a perfect 0.00 second error.',
  },
  {
    id: 'daily_starter',
    title: 'Daily Habit',
    description: 'Complete a Daily Challenge.',
  },
  {
    id: 'week_streak',
    title: 'One Week Hot',
    description: 'Reach a 7 day Daily Challenge streak.',
  },
  {
    id: 'ladder_5',
    title: 'Getting Higher',
    description: 'Clear Level 5 in Time Ladder.',
  },
  {
    id: 'ladder_complete',
    title: 'Top of Time',
    description: 'Complete the full 20 level Time Ladder.',
  },
  {
    id: 'hardcore_god',
    title: 'Godlike Nerve',
    description: 'Unlock GOD difficulty in Hardcore Mode.',
  },
  {
    id: 'chrono_master',
    title: 'Chrono Master',
    description: 'Reach the final Clock Rating rank.',
  },
];

export function getUnlockedAchievementIds(progress: AchievementProgressInput) {
  const unlocked = new Set<string>();

  if (progress.gamesPlayed >= 1) unlocked.add('first_guess');
  if (progress.bestAccuracy !== null && progress.bestAccuracy <= 0.1) unlocked.add('sharp_clock');
  if (progress.spotOns >= 1) unlocked.add('spot_on');
  if (progress.dailyChallengesCompleted >= 1) unlocked.add('daily_starter');
  if (progress.dailyStreak >= 7) unlocked.add('week_streak');
  if (progress.bestLadderLevel >= 5) unlocked.add('ladder_5');
  if (progress.bestLadderLevel >= 20) unlocked.add('ladder_complete');
  if (progress.hardcoreScores.expert >= 3 || progress.hardcoreScores.god > 0 || progress.hardcoreScores.literal > 0) {
    unlocked.add('hardcore_god');
  }
  if (progress.clockRating >= 3000) unlocked.add('chrono_master');

  return unlocked;
}
