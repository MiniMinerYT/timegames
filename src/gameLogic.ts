export const rankThresholds = [0, 200, 450, 800, 1300, 2000, 3000] as const;

export const rankDefinitions = [
  { min: 0, name: 'Bronze Clock', icon: '\u{1F949}' },
  { min: 500, name: 'Silver Clock', icon: '\u{1F948}' },
  { min: 1000, name: 'Gold Clock', icon: '\u{1F947}' },
  { min: 1500, name: 'Platinum Clock', icon: '\u{1F48E}' },
  { min: 2000, name: 'Diamond Clock', icon: '\u{1F4A0}' },
  { min: 2500, name: 'Master Clock', icon: '\u{1F451}' },
  { min: 3000, name: 'Chrono Master', icon: '\u{23F3}' },
] as const;

export const ranks = rankDefinitions.map((rank, index) => ({
  ...rank,
  min: rankThresholds[index] ?? 0,
}));

export function getRank(rating: number) {
  const rankIndex = [...ranks].reverse().findIndex(rank => rating >= rank.min);
  const index = ranks.length - 1 - rankIndex;
  const rank = ranks[index];
  const next = ranks[index + 1] ?? null;
  const progress = next
    ? ((rating - rank.min) / (next.min - rank.min)) * 100
    : 100;

  return {
    rank,
    next,
    pointsNeeded: next ? next.min - rating : 0,
    progress: Math.max(0, Math.min(100, progress)),
  };
}

export function calculateRatingChange(error: number, rating: number) {
  if (rating >= 450 && error >= 2) {
    const severity =
      error >= 6 ? 3 :
      error >= 4 ? 2 :
      1;
    const rankPressure =
      rating >= 3000 ? 18 :
      rating >= 2000 ? 15 :
      rating >= 1300 ? 12 :
      rating >= 800 ? 9 :
      5;
    return -Math.min(60, rankPressure * severity);
  }

  const baseGain =
    error < 0.005 ? 260 :
    error < 0.05 ? 180 :
    error < 0.1 ? 115 :
    error < 0.25 ? 65 :
    error < 0.5 ? 48 :
    error < 1 ? 30 :
    error < 2 ? 18 :
    error < 3 ? 8 : 0;

  const difficulty =
    rating < 450 ? 0.92 :
    rating < 800 ? 0.72 :
    rating < 1300 ? 0.5 :
    rating < 2000 ? 0.34 :
    rating < 3000 ? 0.22 : 0.14;

  return baseGain === 0 ? 0 : Math.max(1, Math.round(baseGain * difficulty));
}

export function getDailyReward(streak: number) {
  const rewards = [10, 15, 20, 30, 40, 50, 60, 75, 90];
  return streak >= 10 ? 100 : rewards[Math.max(0, streak - 1)] ?? 10;
}

export function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDailyTarget(dateKey: string) {
  let hash = 2166136261;
  for (const character of `TimeGames:${dateKey}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  const normalized = (hash >>> 0) / 4294967295;
  return Math.round((1.5 + normalized * 8.5) * 100) / 100;
}

export function getWeightedStandardTarget(random = Math.random) {
  const roll = random();
  let min = 4;
  let max = 8;

  if (roll < 0.48) {
    min = 4;
    max = 8;
  } else if (roll < 0.68) {
    min = 3;
    max = 6;
  } else if (roll < 0.88) {
    min = 8;
    max = 10;
  } else if (roll < 0.96) {
    min = 1.5;
    max = 3;
  } else if (roll < 0.99) {
    min = 10;
    max = 15;
  } else {
    min = 15;
    max = 20;
  }

  return Math.round((min + random() * (max - min)) * 100) / 100;
}

export function getSimulatedDailyStanding(error: number, dateKey: string) {
  let seed = 0;
  for (const character of dateKey) seed = (seed * 31 + character.charCodeAt(0)) >>> 0;
  const players = 6000 + (seed % 9001);
  const percentile = Math.max(1, Math.min(99, Math.round(100 * Math.exp(-error * 1.35))));
  const rank = Math.max(1, Math.round(players * (1 - percentile / 100)));
  return { players, percentile, rank };
}

export function sanitizeTimeInput(value: string) {
  const normalized = value.replace(',', '.').replace(/[^\d.]/g, '');
  const [whole = '', ...fractionParts] = normalized.split('.');
  const leadingDecimal = normalized.startsWith('.');
  const limitedWhole = whole.slice(0, 2);
  if (fractionParts.length === 0 && whole.length > 2) {
    return `${limitedWhole}.${whole.slice(2, 4)}`;
  }
  if (fractionParts.length === 0) return limitedWhole;
  return `${leadingDecimal ? '0' : limitedWhole}.${fractionParts.join('').slice(0, 2)}`;
}

export function isValidTimeInput(value: string) {
  return /^(?:\d{1,2}(?:\.\d{1,2})?|(?:0)?\.\d{1,2})$/.test(value) && Number.isFinite(Number(value));
}
