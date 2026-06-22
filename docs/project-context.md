# TimeGames Project Context

TimeGames is a React, TypeScript, Vite and Tailwind collection of focused time-based games. Its central theme is mastering the player's internal clock.

## Main Menu Flow

The Home screen is the top-level game collection. It contains:
- TimeGames title and clock logo
- Current Clock Rank, Clock Rating and progress to the next rank
- Settings button
- Time Guesser card
- Time Ladder card
- Precision Mode placeholder card
- Stats card

Daily Challenge, Party Mode and Single Player are not top-level games. They live inside Time Guesser.

All primary screens use the fixed 680px card layout. Long content scrolls inside cards using a visible scrollbar rather than scrolling the whole page.

## Game 1: Time Guesser

Time Guesser is the original hidden-clock game. A hidden clock runs for a secret length of time and the player guesses how long it ran.

Its menu contains:
- Single Player, dynamically labelled Ranked or Casual
- Party Mode
- Daily Challenge
- Previous Daily Challenges

The ranked toggle in the Time Guesser menu and Settings controls how the next Single Player round is treated.

### Single Player

After a fixed 3-second countdown, the app generates a weighted random target and runs the hidden clock. The player enters a guess after it stops.

The result shows:
- Secret time
- Player guess
- Absolute error
- Feedback message
- Clock Rating change and rank progress for ranked rounds

Casual and ranked rounds update general stats. Only ranked rounds affect Clock Rating. The casual-result ranked control can enable or disable ranked mode for the next round.

### Party Mode

At least two players are required. After the fixed 3-second countdown and hidden clock, players enter guesses. Blank players are skipped.

Pressing Enter on a valid Party guess formats it and focuses the next player's input.

The result ranks participating players by absolute error. Players within 0.005 seconds of the best error tie for first and each receive one point. The in-session scoreboard, players and scores are not persisted across reloads. Party Mode never affects Clock Rating or general stats.

Party target ranges:
- Short: 2–6 seconds
- Standard: weighted standard target generation
- Long: 8–20 seconds

### Daily Challenge

Each local calendar date has a deterministic target between 0.5 and 10 seconds. A player receives one official attempt for the current date. Official results persist and the UI encourages the player to return tomorrow.

After completing today's challenge, the Daily screen shows:
- Guess, target and error
- A simulated global rank-style standing
- Previous seven Daily Challenges

The simulated global standing is explicitly placeholder logic generated locally from the date and error. It must be replaced by real backend leaderboard data if a backend is introduced.

Previous Daily Challenges may be played without limit. The best practice error for each date persists locally and appears next to that day's replay control. After a practice result, the player can replay the same date or choose another date. Practice rounds do not update general stats or Clock Rating.

Official Daily attempts update general gameplay stats but never Clock Rating.

### Standard Target Generation

Single Player and standard Party rounds use these weighted ranges:
- 50%: 4–8 seconds
- 15%: 2–4 seconds
- 15%: 8–10 seconds
- 15%: 10–20 seconds
- 5%: 0.3–2 seconds

Targets are rounded to two decimal places.

## Game 2: Time Ladder

Time Ladder is a separate stop-the-clock game. It does not affect Clock Rating or the general Time Guesser statistics.

Rules:
- Every level starts with a fixed 3-second countdown.
- Level 1 targets 1.00 second, Level 2 targets 2.00 seconds, continuing through Level 20 at 20.00 seconds.
- The timer is hidden while running.
- The player must stop within ±0.25 seconds of the target, inclusive, to progress.
- One miss ends the run.
- Completing Level 20 completes the ladder.

The highest successfully cleared level persists in localStorage and is shown on the Home, Time Ladder and Stats screens. Time Ladder uses a visual climb grid and progress bar inside the standard fixed card.

## Game 3: Precision Mode

Precision Mode is currently a non-interactive placeholder on the Home screen.

It communicates:
- “Hit exact target times”
- “Coming soon”

No Precision Mode gameplay or persistence is implemented yet.

## Clock Rating and Ranks

Clock Rating starts at zero, cannot fall below zero and changes only after ranked Single Player Time Guesser guesses.

Rank thresholds:
- 0–199: Bronze Clock, 🥉
- 200–449: Silver Clock, 🥈
- 450–799: Gold Clock, 🥇
- 800–1299: Platinum Clock, 💎
- 1300–1999: Diamond Clock, 💠
- 2000–2999: Master Clock, 👑
- 3000+: Chrono Master, ⏳

Base gains by absolute error:
- Under 0.005 seconds: 110
- Under 0.1 seconds: 85
- Under 0.25 seconds: 65
- Under 0.5 seconds: 48
- Under 1 second: 30
- Under 2 seconds: 18
- Under 3 seconds: 8
- 3 seconds or more: 0

Gains taper at higher ratings. Losses begin at Platinum Clock for errors of at least 3 seconds and currently range from 4 to 20 points.

Clock Rating is unaffected by Casual Single Player, Party Mode, Daily Challenge, Daily practice, Time Ladder and Precision Mode.

## Settings

Settings persist in localStorage. Current settings:
- Sounds
- Haptic feedback
- Ranked Time Guesser mode
- Reduced motion
- Dark mode
- Party timer range

Countdown length and high contrast are not configurable. Every implemented game uses a fixed 3-second countdown. Larger Controls is not currently implemented and is not reintroduced.

The operating system reduced-motion preference is respected in addition to the saved setting.

## Input and Navigation UX

Time guesses request the mobile decimal keypad and accept no more than two digits before and two digits after the decimal point.

Enter submits valid Single Player and Daily Challenge guesses. In Party Mode, Enter advances focus to the next player's guess field.

Menu buttons provide short feedback tones when sounds are enabled. Gameplay retains countdown, stop and result tones plus optional haptics.

## Statistics

The Stats screen contains:
- Games played
- Best accuracy
- Average error
- Spot Ons
- Best Time Ladder level
- Clock Rating with current rank
- Points to the next rank

General accuracy stats include Single Player and official Daily Challenge attempts. Party Mode, Daily practice and Time Ladder are excluded. Errors of 100 seconds or more are excluded from average error to avoid accidental inputs skewing the result.

Stats reset clears general stats and Clock Rating after confirmation. It does not clear Daily history, Daily practice bests or the Time Ladder best level. Streaks are not used.

## Persistence

localStorage keys:
- `timegames-stats`: general accuracy stats, Clock Rating and average-error sample count
- `timegames-settings`: settings and ranked-mode preference
- `timegames-daily-results`: official Daily results keyed by local date
- `timegames-daily-practice-bests`: best practice error keyed by Daily date
- `timegames-ladder-best`: highest successfully cleared Time Ladder level

Party players and scores remain in React state only.

## UI Requirements

- Preserve the fixed 680px card and mobile-first maximum width.
- Keep scrolling inside cards and use visible internal scrollbar styling.
- Preserve rounded cards and teal, indigo and rose accents.
- Preserve the result flip card, hidden-clock shimmer, Spot On glow and confetti.
- Preserve reduced-motion and dark-mode support.
- Avoid whole-page scrolling and fixed-card overflow.

## Technical Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- lucide-react
- localStorage persistence

## Important Development Rules

- Preserve the Home → game hub structure.
- Preserve Time Guesser Single Player, Party Mode, Daily Challenge and Daily history.
- Preserve Time Ladder rules and persistence.
- Keep Time Ladder, Party, Daily and casual play isolated from Clock Rating.
- Preserve localStorage-backed settings and stats.
- Prefer focused components over continuing to enlarge `App.tsx`.
- Preserve existing animations and fixed-card scrolling.
- Run `npm run build` after code changes and fix introduced TypeScript errors.
