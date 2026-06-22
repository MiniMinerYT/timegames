# TimeGames Project Context

TimeGames is a React, TypeScript, Vite and Tailwind web app.

The game is based around testing how accurate a player's internal clock is.

## Core Game Modes

### Single Player

The app secretly chooses a random time. After the configured countdown (off, 3 seconds or 5 seconds), the hidden timer runs until the secret time has elapsed. The player then enters a guess for how much time passed.

The result shows:
- The secret time
- The player's guess
- How far off they were
- A feedback message
- Ranked progress if ranked mode is enabled

Single Player can be played as ranked or casual. Both variants update the general gameplay stats, but only ranked rounds affect Clock Rating.

### 10 Second Challenge

The player starts after the configured countdown and tries to stop a hidden stopwatch as close to exactly 10 seconds as possible.

This mode is casual only and does not affect Clock Rating. It updates the general gameplay stats and stores the closest 10-second attempt as a personal best.

### Party Mode

Players add at least two names before starting. Player names, guesses and scores are kept for the current browser session but are not stored in localStorage.

The app secretly chooses a time. After the timer ends, each player can enter a guess. Players who leave their guess blank are skipped for that round.

The results screen ranks participating players by who was closest.

If multiple players are within 0.005 seconds of the best error:
- Show "It's a tie!"
- Mark each tied winner as 1st
- Give each tied winner +1 point

Party Mode has a scoreboard view for the current session. Party rounds do not update the general stats or Clock Rating.

The Party Timer Range setting controls target generation:
- Short: 2 to 6 seconds
- Standard: uses the standard weighted target ranges
- Long: 8 to 20 seconds

## Target Time Generation

Single Player and standard Party rounds use weighted random target ranges:
- 50%: 4 to 8 seconds
- 15%: 2 to 4 seconds
- 15%: 8 to 10 seconds
- 15%: 10 to 20 seconds
- 5%: 0.3 to 2 seconds

Generated target times are rounded to two decimal places.

## Ranked System

The app has a persistent Clock Rating used only for Single Player ranked mode.

Clock Rating:
- Starts at 0
- Is stored in localStorage as part of `timegames-stats`
- Only changes after a valid Single Player guess when ranked mode is enabled
- Does not change in casual Single Player
- Does not change in 10 Second Challenge
- Does not change in Party Mode
- Cannot fall below 0

Rank thresholds:
- 0 to 199: Bronze Clock, 🥉
- 200 to 449: Silver Clock, 🥈
- 450 to 799: Gold Clock, 🥇
- 800 to 1299: Platinum Clock, 💎
- 1300 to 1999: Diamond Clock, 💠
- 2000 to 2999: Master Clock, 👑
- 3000+: Chrono Master, ⏳

Rating gains are based on absolute error:
- Under 0.005 seconds: base gain of 110
- Under 0.1 seconds: base gain of 85
- Under 0.25 seconds: base gain of 65
- Under 0.5 seconds: base gain of 48
- Under 1 second: base gain of 30
- Under 2 seconds: base gain of 18
- Under 3 seconds: base gain of 8
- 3 seconds or more: base gain of 0

The base gain is reduced at higher ratings, making progression increasingly difficult. A successful result always awards at least 1 point after the rating multiplier is applied.

Rating losses begin at Platinum Clock (800 rating). An error of at least 3 seconds causes a loss based on the player's current rating and whether the error is at least 5 seconds. The current loss values range from 4 to 20 points.

The UI shows the current rank, progress to the next rank and points remaining. A separate Clock Ranks screen lists every threshold.

## Settings

The app has a settings screen accessible from the home screen. Settings persist in localStorage under `timegames-settings`.

Current settings:
- Sounds on/off
- Haptic feedback on/off
- Ranked mode on/off from the home screen
- Reduced motion on/off
- High contrast on/off
- Larger controls on/off
- Countdown length: off, 3 seconds or 5 seconds
- Result precision: 2 or 3 decimal places
- Party timer range: Short, Standard or Long

If ranked mode is off, Single Player is labelled as casual and does not affect Clock Rating. The operating system's reduced-motion preference is also respected independently of the saved setting.

## Stats

Stats persist in localStorage under `timegames-stats`.

Current stats:
- Games played
- Best accuracy
- Average error
- Spot Ons
- Clock Rating
- 10-second personal best

Games played, best accuracy, average error and Spot Ons aggregate completed Single Player and 10 Second Challenge rounds. Party rounds are excluded.

A Spot On is recorded when the absolute error is under 0.005 seconds. The 10-second personal best stores the elapsed time whose error from 10 seconds is smallest.

Reset Statistics clears all saved stats, including Clock Rating and the 10-second personal best, after a confirmation prompt.

Streaks are not used.

## Persistence

The app uses localStorage for:
- `timegames-stats`: general stats, Clock Rating and the 10-second personal best
- `timegames-settings`: all settings, including ranked mode

Party players and scores are held in React state and are not persisted across page reloads.

## UI Requirements

The app uses a fixed card-style layout with a height of 680px and a maximum width suitable for mobile screens.

Important:
- Keep screens clean and uncluttered.
- Avoid overflowing the fixed card height.
- Use internal scroll areas where needed.
- Do not add whole-page scrolling unless absolutely necessary.
- Keep the visual style consistent with rounded cards, teal accents, simple icons and Tailwind classes.
- Preserve the result flip card, hidden-timer shimmer, Spot On glow and confetti animations.
- Preserve reduced-motion support.

## Technical Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- lucide-react icons
- localStorage for persistence

## Important Development Rules

When editing the project:
- Do not remove existing game modes.
- Do not break Party Mode.
- Do not break 10 Second Challenge.
- Do not break Single Player results.
- Preserve the ranking system.
- Preserve localStorage-backed settings and stats.
- Preserve the fixed card layout and internal scrolling.
- Preserve the flip card, shimmer, glow and confetti CSS.
- If changes require `index.css` updates, mention them clearly.
- Prefer small components over making `App.tsx` larger forever.
- Run `npm run build` after code changes and fix any TypeScript errors introduced by those changes.
