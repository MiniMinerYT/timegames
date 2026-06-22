# TimeGames Project Context

TimeGames is a React, TypeScript, Vite and Tailwind web app.

The game is based around testing how accurate a player's internal clock is.

## Core Game Modes

### Single Player

The app secretly chooses a random time. The timer starts after a 3 second countdown. The player waits until the hidden timer stops, then enters their guess for how much time passed.

The result shows:
- The secret time
- The player's guess
- How far off they were
- A feedback message
- Ranked progress if ranked mode is enabled

Single Player can be played as ranked or casual.

### 10 Second Challenge

The player tries to stop the timer as close to exactly 10 seconds as possible.

This mode is casual only and must not affect Clock Rating.

### Party Mode

Players add names before starting.

The app secretly chooses a time. After the timer ends, each player can enter a guess.

The results screen ranks players by who was closest.

If multiple players are tied within 0.005 seconds:
- Show “It’s a tie!”
- Mark each tied winner as 1st
- Give each tied winner +1 point

Party Mode has a scoreboard view and should support skipping players who do not enter a guess.

## Ranked System

The app has a persistent Clock Rating used only for Single Player ranked mode.

Clock Rating:
- Starts at 0
- Is stored in localStorage
- Only changes in Single Player when ranked mode is enabled
- Does not change in 10 Second Challenge
- Does not change in Party Mode

Rank thresholds:
- 0 to 499: Bronze Clock, 🥉
- 500 to 999: Silver Clock, 🥈
- 1000 to 1499: Gold Clock, 🥇
- 1500 to 1999: Platinum Clock, 💎
- 2000 to 2499: Diamond Clock, 💠
- 2500 to 2999: Master Clock, 👑
- 3000+: Chrono Master, ⏳

Ranking philosophy:
- Early players should not lose rating.
- Bad early results should give +0 instead of negative rating.
- The higher the player rating, the harder it should be to gain rating.
- Losses should only become possible around Platinum and above.
- The UI should show progress to the next rank and points remaining.

## Settings

The app has a settings screen accessible from the home screen.

Settings should persist in localStorage.

Current settings:
- Sounds on/off
- Haptic feedback on/off
- Ranked mode on/off
- Reduced motion on/off, if implemented

If ranked mode is off, Single Player should be labelled as casual or unranked and should not affect Clock Rating.

## Stats

Stats should focus on meaningful progression.

Important stats:
- Clock Rating
- Current rank
- Games played
- Best accuracy
- Average error
- Spot Ons

Streaks should not be used unless there is a clear gameplay reason.

## UI Requirements

The app uses a fixed card-style layout.

Important:
- Keep screens clean and uncluttered.
- Avoid overflowing the fixed card height.
- Use internal scroll areas where needed.
- Do not add whole-page scrolling unless absolutely necessary.
- Keep the visual style consistent with rounded cards, teal accents, simple icons and Tailwind classes.

## Technical Stack

- React
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
- Preserve localStorage-backed settings and stats.
- Preserve the flip card, shimmer and confetti CSS if present.
- If changes require index.css updates, mention them clearly.
- Prefer small components over making App.tsx larger forever.