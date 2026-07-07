export type StreamerRank = {
  name: string;
  min: number;
  icon: string;
};

export const streamerRanks: StreamerRank[] = [
  { min: 0, name: 'New Viewer', icon: '*' },
  { min: 60, name: 'Good Guess', icon: '^' },
  { min: 160, name: 'Sharp Timer', icon: '<>' },
  { min: 320, name: 'Clock Caller', icon: 'Star' },
  { min: 560, name: 'Stream Chrono', icon: 'Pro' },
];

export function getStreamerRank(points: number) {
  return streamerRanks.reduce((best, rank) => points >= rank.min ? rank : best, streamerRanks[0]);
}

export function getStreamerRankPoints(error: number | null, placement: number) {
  if (error === null) return 0;
  const accuracyPoints =
    error < 0.05 ? 80 :
    error < 0.1 ? 60 :
    error < 0.25 ? 42 :
    error < 0.5 ? 28 :
    error < 1 ? 16 :
    error < 2 ? 8 :
    2;
  const placementBonus = placement === 0 ? 28 : placement === 1 ? 16 : placement === 2 ? 10 : 0;
  return accuracyPoints + placementBonus;
}

export function getStreamerRankDelta(error: number | null, placement: number) {
  if (error === null) return 0;
  if (placement === 0) return 34;
  if (placement === 1) return 24;
  if (placement === 2) return 16;
  if (placement === 3) return 8;
  if (placement === 4) return 4;
  if (error < 0.5) return 2;
  if (error < 1) return -2;
  if (error < 2) return -5;
  return -9;
}
