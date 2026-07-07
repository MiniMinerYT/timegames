import { type ComponentType, type ReactNode, type RefObject } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  Clock,
  Gamepad2,
  HelpCircle,
  Radio,
  Settings,
  Skull,
  Smartphone,
  Timer,
  Trophy,
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
  notification?: DesktopShellNotification | null;
  ratingPulse?: DesktopRatingPulse | null;
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
  detail?: string;
  detailSubtext?: string;
  detailTone?: 'positive' | 'negative' | 'neutral';
};

export type DesktopShellNotification = {
  eyebrow: string;
  title: string;
  tone?: 'rank' | 'rank-down' | 'achievement' | 'unlock';
};

export type DesktopRatingPulse = {
  tone: 'positive' | 'negative' | 'neutral';
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
  onStreamerMode: () => void;
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
  notification,
  ratingPulse,
  onHome,
  onBack,
  onRankings,
  onToggleVerticalLayout,
  onStats,
  onSettings,
}: DesktopShellProps) {
  const rankInfo = getRank(clockRating);
  const { rank } = rankInfo;
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
            <button type="button" onClick={onBack} className="desktop-back-button" aria-label="Back">
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>
          ) : (
            <div className="desktop-store-links" aria-label="Download app links coming soon">
              <button type="button" disabled className="desktop-store-button">
                <Smartphone className="w-4 h-4" />
                iOS App
              </button>
              <button type="button" disabled className="desktop-store-button">
                <Smartphone className="w-4 h-4" />
                Android
              </button>
            </div>
          )}
          {hasLeftContext && (
            <div className="desktop-topbar-context-group">
              {context.detail && (
                <div className={`desktop-context-detail desktop-context-detail-${context.detailTone ?? 'neutral'} ${context.detailSubtext ? 'desktop-context-detail-rotating' : ''}`}>
                  <div className="desktop-context-detail-text">
                    {context.detailSubtext ? (
                      <div className="desktop-context-ticker">
                        <motion.span
                          key={context.detail}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.22, ease: 'easeOut' }}
                        >
                          {context.detail}
                        </motion.span>
                        <span>{context.detailSubtext}</span>
                      </div>
                    ) : (
                      <motion.span
                        key={context.detail}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.22, ease: 'easeOut' }}
                      >
                        {context.detail}
                      </motion.span>
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
              {contextAction?.detail && (
                <div className={`desktop-context-detail desktop-context-detail-compact desktop-context-detail-${contextAction.detailTone ?? 'neutral'}`}>
                  <div className="desktop-context-detail-text">
                    <span>{contextAction.detail}</span>
                    {contextAction.detailSubtext && <span>{contextAction.detailSubtext}</span>}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <button type="button" onClick={onHome} className={`desktop-topbar-brand desktop-topbar-brand-${context.accent ?? 'teal'}`} aria-label="Back to TimeGames home">
          <motion.div
            className={`desktop-topbar-brand-content ${notification ? 'desktop-topbar-brand-content-muted' : ''}`}
            animate={notification ? { y: -10, opacity: 0 } : { y: 0, opacity: 1 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="desktop-topbar-logo">
              <ContextIcon className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0">
              <p className="desktop-topbar-title">{context.title}</p>
              <p className="desktop-topbar-subtitle">{context.subtitle}</p>
            </div>
          </motion.div>
          <AnimatePresence mode="wait">
            {notification && (
              <motion.div
                key={`${notification.eyebrow}-${notification.title}`}
                className={`desktop-dynamic-island desktop-dynamic-island-${notification.tone ?? 'rank'}`}
                initial={{ y: 18, opacity: 0, scale: 0.94, rotateX: -72 }}
                animate={{ y: 0, opacity: 1, scale: 1, rotateX: 0 }}
                exit={{ y: -18, opacity: 0, scale: 0.94, rotateX: 72 }}
                transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
              >
                <span>{notification.eyebrow}</span>
                <strong>{notification.title}</strong>
              </motion.div>
            )}
          </AnimatePresence>
        </button>

        <div className="desktop-topbar-actions">
          <button
            type="button"
            onClick={onRankings}
            data-guide-id="result-rating"
            className={`desktop-rating-pill ${ratingPulse ? `desktop-rating-pill-flash desktop-rating-pill-${ratingPulse.tone}` : ''}`}
            aria-label={`View Clock Ranks. Current rating ${clockRating}, ${rank.name}`}
          >
            <span className="desktop-rating-icon" aria-hidden="true">{rank.icon}</span>
            <span className="desktop-rating-copy">
              <strong>{clockRating}</strong>
              <span>{rank.name}</span>
            </span>
            <span className="desktop-rating-progress" aria-hidden="true">
              <motion.span
                initial={false}
                animate={{ width: `${rankInfo.progress}%` }}
                transition={{ duration: 0.58, ease: [0.16, 1, 0.3, 1] }}
              />
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
  modePlayCounts,
  iconRef,
  onRankedTimeGuesser,
  onCasualTimeGuesser,
  onTimeLadder,
  onHardcore,
  onDailyChallenge,
  onPartyMode,
  onStreamerMode,
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
      icon: Trophy,
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
      eyebrow: todayResult ? 'Completed today' : 'Daily target',
      description: todayResult ? (dailyRank ? `Rank #${dailyRank}. Come back tomorrow.` : 'Come back tomorrow.') : 'One official stop each day.',
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
      icon: Gamepad2,
      accent: 'slate',
      onClick: () => undefined,
      disabled: true,
      basePriority: 14,
    },
    {
      id: 'streamer',
      title: 'Streamer Mode',
      eyebrow: 'Twitch chat',
      description: 'Run live viewer guesses through connected chat.',
      icon: Radio,
      accent: 'cyan',
      onClick: onStreamerMode,
      basePriority: 46,
    },
  ];
  const sortedCards = [...cards].sort((a, b) => {
    const aScore = a.basePriority + (modePlayCounts[a.id] ?? 0) * 8 + (a.id === 'daily' && !todayResult ? 1000 : 0);
    const bScore = b.basePriority + (modePlayCounts[b.id] ?? 0) * 8 + (b.id === 'daily' && !todayResult ? 1000 : 0);
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
            <span className="desktop-game-card-art" aria-hidden="true">
              <Icon className="w-full h-full" />
            </span>
            <span className="desktop-game-card-text">
              <span>{eyebrow}</span>
              <strong>{title}</strong>
              <em>{description}</em>
              {id === 'daily' && !todayResult && (
                <span className="desktop-daily-metrics">
                  <b>+{nextDailyReward} rating</b>
                </span>
              )}
              {id === 'daily' && todayResult && (
                <span className="desktop-daily-metrics desktop-daily-metrics-complete">
                  <b>Completed</b>
                </span>
              )}
              {id === 'daily' && !todayResult && (
                <span className="desktop-daily-nudge">
                  {dailyStreak > 0
                    ? `${dailyStreak} day streak on the line. Land today's stop before midnight.`
                    : "Start your streak with today's one-shot challenge."}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
