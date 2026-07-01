import { type ComponentType, type ReactNode, type RefObject } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  Clock,
  HelpCircle,
  Radio,
  Settings,
  Skull,
  Smartphone,
  Timer,
  Users,
} from 'lucide-react';
import LadderIcon from './LadderIcon';
import { getRank } from './gameLogic';

type ShellProps = {
  children: ReactNode;
  tabletop?: boolean;
};

type DesktopShellProps = {
  children: ReactNode;
  clockRating: number;
  desktopVerticalLayout: boolean;
  showBack: boolean;
  context: DesktopShellContext;
  contextAction?: DesktopShellAction | null;
  onHome: () => void;
  onBack: () => void;
  onRankings: () => void;
  onToggleVerticalLayout: () => void;
  onStats: () => void;
  onSettings: () => void;
};

export type DesktopShellContext = {
  title: string;
  subtitle: string;
  icon: 'home' | 'timer' | 'daily' | 'ladder' | 'hardcore' | 'party' | 'stats' | 'settings' | 'rankings' | 'streamer';
  accent?: 'teal' | 'emerald' | 'rose' | 'indigo' | 'red' | 'cyan' | 'slate' | 'yellow';
  detail?: string;
  detailSubtext?: string;
  detailProgress?: number;
  detailTone?: 'positive' | 'negative' | 'neutral';
};

export type DesktopShellAction = {
  label: string;
  onClick: () => void;
  icon?: 'settings' | 'hardcore' | 'rankings' | 'help';
};

export type DesktopLauncherModeId =
  | 'time-guesser-ranked'
  | 'time-guesser-casual'
  | 'daily'
  | 'ladder'
  | 'hardcore'
  | 'party'
  | 'multiplayer'
  | 'streamer';

type DesktopHomeLauncherProps = {
  bestLadderLevel: number;
  bestHardcoreScore: number;
  todayResult: {
    globalRank?: number | null;
    simulatedRank?: number;
  } | null;
  todayLeaderboard: {
    playerRank?: number | null;
  } | null;
  dailyStreak: number;
  nextDailyReward: number;
  dailyCountdown: string;
  modePlayCounts: Partial<Record<DesktopLauncherModeId, number>>;
  iconRef?: RefObject<HTMLDivElement>;
  onRankedTimeGuesser: () => void;
  onCasualTimeGuesser: () => void;
  onTimeLadder: () => void;
  onHardcore: () => void;
  onDailyChallenge: () => void;
  onPartyMode: () => void;
};

export function MobileAppShell({ children, tabletop = false }: ShellProps) {
  return (
    <div className={`app-shell relative min-h-0 ${tabletop ? 'tabletop-frame' : ''}`}>
      {children}
    </div>
  );
}

export function DesktopVerticalShell({ children, tabletop = false }: ShellProps) {
  return (
    <div className={`app-shell relative min-h-0 desktop-vertical-shell ${tabletop ? 'tabletop-frame' : ''}`}>
      {children}
    </div>
  );
}

export function DesktopAppShell({
  children,
  clockRating,
  desktopVerticalLayout,
  showBack,
  context,
  contextAction,
  onHome,
  onBack,
  onRankings,
  onToggleVerticalLayout,
  onStats,
  onSettings,
}: DesktopShellProps) {
  const rank = getRank(clockRating).rank;
  const hasLeftContext = Boolean(context.detail || contextAction);
  const ContextIcon = {
    home: Clock,
    timer: Timer,
    daily: CalendarDays,
    ladder: LadderIcon,
    hardcore: Skull,
    party: Users,
    stats: BarChart3,
    settings: Settings,
    rankings: Clock,
    streamer: Radio,
  }[context.icon];
  const ActionIcon = contextAction?.icon
    ? {
        settings: Settings,
        hardcore: Skull,
        rankings: Clock,
        help: HelpCircle,
      }[contextAction.icon]
    : null;

  return (
    <div className="app-shell relative min-h-0 desktop-shell">
      <header className="desktop-topbar">
        <div className="desktop-topbar-left">
          {showBack ? (
            <button type="button" onClick={onBack} className="desktop-back-button" aria-label="Back to all games">
              <ArrowLeft className="w-5 h-5" />
              All Games
            </button>
          ) : (
            <span className="desktop-back-placeholder" aria-hidden="true" />
          )}
          {hasLeftContext && (
            <div className="desktop-topbar-context-group">
              {context.detail && (
                <div className={`desktop-context-detail desktop-context-detail-${context.detailTone ?? 'neutral'}`}>
                  <div className="desktop-context-detail-text">
                    <motion.span
                      key={context.detail}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.22, ease: 'easeOut' }}
                    >
                      {context.detail}
                    </motion.span>
                    {context.detailSubtext && (
                      <span>{context.detailSubtext}</span>
                    )}
                  </div>
                  {typeof context.detailProgress === 'number' && (
                    <div className="desktop-context-progress" aria-hidden="true">
                      <motion.div
                        initial={false}
                        animate={{ width: `${context.detailProgress}%` }}
                        transition={{ duration: 0.62, ease: [0.16, 1, 0.3, 1] }}
                      />
                    </div>
                  )}
                </div>
              )}
              {contextAction && (
                <button type="button" onClick={contextAction.onClick} className="desktop-action-button desktop-context-action">
                  {ActionIcon && <ActionIcon className="w-4 h-4" />}
                  {contextAction.label}
                </button>
              )}
            </div>
          )}
        </div>

        <button type="button" onClick={onHome} className={`desktop-topbar-brand desktop-topbar-brand-${context.accent ?? 'teal'}`} aria-label="Back to TimeGames home">
          <div className="desktop-topbar-logo">
            <ContextIcon className="w-6 h-6 text-white" />
          </div>
          <div className="min-w-0">
            <p className="desktop-topbar-title">{context.title}</p>
            <p className="desktop-topbar-subtitle">{context.subtitle}</p>
          </div>
        </button>

        <div className="desktop-topbar-actions">
          <button
            type="button"
            onClick={onRankings}
            className="desktop-rating-pill"
            aria-label={`View Clock Ranks. Current rating ${clockRating}, ${rank.name}`}
          >
            <span className="desktop-rating-icon" aria-hidden="true">{rank.icon}</span>
            <span>
              <strong>{clockRating}</strong>
              <span>{rank.name}</span>
            </span>
          </button>
          <button
            type="button"
            onClick={onToggleVerticalLayout}
            className="desktop-action-button"
            aria-pressed={desktopVerticalLayout}
          >
            <Smartphone className="w-4 h-4" />
            Vertical
          </button>
          <button type="button" onClick={onStats} className="desktop-action-button">
            <BarChart3 className="w-4 h-4" />
            Stats
          </button>
          <button type="button" onClick={onSettings} className="desktop-icon-button" aria-label="Open settings">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="desktop-play-stage">
        {children}
      </main>
    </div>
  );
}

export function DesktopHomeLauncher({
  bestLadderLevel,
  bestHardcoreScore,
  todayResult,
  todayLeaderboard,
  dailyStreak,
  nextDailyReward,
  dailyCountdown,
  modePlayCounts,
  iconRef,
  onRankedTimeGuesser,
  onCasualTimeGuesser,
  onTimeLadder,
  onHardcore,
  onDailyChallenge,
  onPartyMode,
}: DesktopHomeLauncherProps) {
  const dailyRank = todayLeaderboard?.playerRank ?? todayResult?.globalRank ?? todayResult?.simulatedRank;
  const cards: Array<{
    id: DesktopLauncherModeId;
    guideId?: string;
    title: string;
    eyebrow: string;
    description: string;
    icon: ComponentType<{ className?: string }>;
    accent: 'teal' | 'emerald' | 'rose' | 'indigo' | 'red' | 'cyan' | 'slate';
    onClick: () => void;
    disabled?: boolean;
    basePriority: number;
  }> = [
    {
      id: 'time-guesser-ranked',
      guideId: 'home-time-guesser',
      title: 'Time Guesser Ranked',
      eyebrow: 'Clock Rating on',
      description: 'Build rank by guessing hidden time.',
      icon: Timer,
      accent: 'teal',
      onClick: onRankedTimeGuesser,
      basePriority: 88,
    },
    {
      id: 'time-guesser-casual',
      title: 'Time Guesser Casual',
      eyebrow: 'No rating pressure',
      description: 'Practice the hidden clock at your own pace.',
      icon: Timer,
      accent: 'emerald',
      onClick: onCasualTimeGuesser,
      basePriority: 82,
    },
    {
      id: 'daily',
      guideId: 'home-daily',
      title: 'Daily Challenge',
      eyebrow: todayResult ? 'Completed today' : `+${nextDailyReward} rating`,
      description: todayResult ? `${dailyRank ? `Rank #${dailyRank}. ` : ''}Next in ${dailyCountdown}.` : `${dailyStreak > 0 ? `${dailyStreak} day streak. ` : ''}One official stop each day.`,
      icon: CalendarDays,
      accent: 'rose',
      onClick: onDailyChallenge,
      basePriority: todayResult ? 32 : 96,
    },
    {
      id: 'ladder',
      guideId: 'home-ladder',
      title: 'Time Ladder',
      eyebrow: bestLadderLevel > 0 ? `Best level ${bestLadderLevel}` : 'Precision climb',
      description: 'Clear 1 to 20 seconds with one clean run.',
      icon: LadderIcon,
      accent: 'indigo',
      onClick: onTimeLadder,
      basePriority: bestLadderLevel > 0 ? 74 : 68,
    },
    {
      id: 'hardcore',
      guideId: 'home-hardcore',
      title: 'Hardcore',
      eyebrow: bestHardcoreScore > 0 ? `Best score ${bestHardcoreScore}` : 'Three lives',
      description: 'Endless targets, unlockable difficulty tiers.',
      icon: Skull,
      accent: 'red',
      onClick: onHardcore,
      basePriority: bestHardcoreScore > 0 ? 76 : 66,
    },
    {
      id: 'party',
      guideId: 'home-party',
      title: 'Party Mode',
      eyebrow: 'Local multiplayer',
      description: 'Pass the screen around and find the closest guess.',
      icon: Users,
      accent: 'cyan',
      onClick: onPartyMode,
      basePriority: 48,
    },
    {
      id: 'multiplayer',
      title: 'Multiplayer',
      eyebrow: 'Coming soon',
      description: 'Online head-to-head timing is not live yet.',
      icon: Users,
      accent: 'slate',
      onClick: () => undefined,
      disabled: true,
      basePriority: 14,
    },
    {
      id: 'streamer',
      title: 'Streamer Mode',
      eyebrow: 'Coming later',
      description: 'A stream-ready mode icon for future Twitch play.',
      icon: Radio,
      accent: 'slate',
      onClick: () => undefined,
      disabled: true,
      basePriority: 12,
    },
  ];
  const sortedCards = [...cards].sort((a, b) => {
    const aScore = a.basePriority + (modePlayCounts[a.id] ?? 0) * 8;
    const bScore = b.basePriority + (modePlayCounts[b.id] ?? 0) * 8;
    return bScore - aScore;
  });

  return (
    <section className="desktop-home-launcher" aria-label="TimeGames desktop launcher">
      <div className="desktop-game-grid">
        {sortedCards.map(({ id, guideId, title, eyebrow, description, icon: Icon, accent, onClick, disabled }, index) => (
          <button
            key={title}
            type="button"
            data-guide-id={guideId}
            onClick={onClick}
            disabled={disabled}
            aria-disabled={disabled}
            className={`desktop-game-card desktop-game-card-${accent} ${index === 0 ? 'desktop-game-card-featured' : ''} ${disabled ? 'desktop-game-card-disabled' : ''}`}
          >
            <span ref={id === 'time-guesser-ranked' ? iconRef : undefined} className="desktop-game-card-icon">
              <Icon className="w-8 h-8" />
            </span>
            <span className="desktop-game-card-text">
              <span>{eyebrow}</span>
              <strong>{title}</strong>
              <em>{description}</em>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
