# TimeGames Project Context

TimeGames is a React, TypeScript, Vite and Tailwind collection of focused time-based games. Its central theme is mastering the player's internal clock.

## Main Menu Flow

The Home screen is the top-level game collection. It contains:
- TimeGames title and clock logo
- Time Guesser card
- Time Ladder card
- Hardcore Mode card
- Stats card
- Settings card

Daily Challenge, Party Mode and Single Player are not top-level games. They live inside Time Guesser.

Clock Rating and rank progress appear inside Time Guesser only because ranked Time Guesser is the only game that changes rating.

The Home Time Guesser card indicates whether Single Player is currently Ranked or Casual. Home and Time Guesser game cards use the same centered menu-card treatment, and each top-level game exposes an “All Games” return control.

Shared game-menu cards use a fixed icon column, centered text column and matching spacer column so icons align consistently. Time Guesser, Time Ladder and Hardcore use the same centered icon/title/tagline header structure.

The layout uses a responsive app-card system. Desktop and roomy web screens preserve the polished 680px card presentation, while mobile/native-sized screens use the full available dynamic viewport height with safe-area padding for phone status bars, Dynamic Island/notches and home indicators. The HTML viewport uses `viewport-fit=cover` so iOS exposes safe-area insets correctly. On narrow phone screens the card itself fills the device frame and extends its light/dark background into the safe-area regions, avoiding mismatched top or bottom strips while keeping content padded away from notches and home indicators. Desktop keeps the floating rounded-card look. Content-heavy screens keep key navigation controls outside their scrollable content so actions such as Back remain visible. Scrollable content uses `flex-1 min-h-0 overflow-y-auto` plus modest bottom padding for the action area and safe-area inset, so final settings and stats can scroll fully above persistent bottom controls without oversized blank overscroll gaps.

Top-level menu, game-hub, Stats and Settings screen changes use subtle content-only transitions inside the app card. On desktop the rounded 680px card frame stays stationary; only the contents inside it animate. These one-shot transitions are disabled during active timing windows and are also disabled by the saved or operating-system Reduced Motion preferences.

Menu screens expose a contextual question-mark button in the card's top-left corner. It opens a reusable help dialog over the current screen with page-specific rules and explanations. The dialog respects the available viewport and safe areas, keeps its X close control visible in the top-right, scrolls its body internally when necessary, closes from the backdrop or Escape key and supports light/dark themes. Active Time Guesser gameplay, timing, guess-entry and result screens hide the help control so it does not distract or overlap play. Time Ladder keeps its help entry available, and Hardcore keeps help visible on the difficulty-selection screen only.

## Game 1: Time Guesser

Time Guesser is the original hidden-clock game. A hidden clock runs for a secret length of time and the player guesses how long it ran.

Its menu contains:
- Single Player, dynamically labelled Ranked or Casual
- Party Mode
- Daily Challenge

Challenge Archive is accessed from the Daily Challenge hub rather than through a separate Time Guesser menu button. The immediate gameplay result only offers a return to Time Guesser.

The ranked toggle in the Time Guesser menu controls how the next Single Player round is treated.

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

Party Mode starts with a mode choice on mobile/native-sized builds:
- Standard Party Mode
- Tabletop Mode

Desktop/web pointer layouts may continue to show the standard scored Party flow only.

In Standard Party Mode, at least two players are required. After the fixed 3-second countdown and hidden clock, players enter guesses. Blank players are skipped.

Party guesses use the shared in-app number keypad rather than the native device keyboard. Selecting a player makes them active, and submitting a valid guess formats it and advances to the next player who still needs a guess. Desktop keyboard entry and Enter submission are preserved through the custom keypad handler.

The result ranks participating players by absolute error. Players within 0.005 seconds of the best error tie for first and each receive one point. The in-session scoreboard, players and scores are not persisted across reloads. Party Mode never affects Clock Rating or general stats.

Party results use the same flip-card reveal language as Time Guesser for the secret time before showing the ranked round outcome.

Tabletop Mode is a mobile-first Party variant for a group sitting around one device. It does not ask for player names, guesses or scores. After the hidden timer stops, the screen shows one large `Reveal Time` button. The group can discuss the answer, then tap to dramatically flip/reveal the secret time. Tabletop Mode uses the Party target range setting but never affects Clock Rating, stats or the scored Party leaderboard. The app remains portrait-locked globally; Tabletop does not force physical device landscape. Instead, it presents a horizontal-feeling tabletop board inside the portrait shell with a wide central reveal panel, very large numbers and chunky controls so it reads well when the phone is placed on a table.

Party target ranges:
- Short: 2–6 seconds
- Standard: weighted standard target generation
- Long: 8–20 seconds

### Daily Challenge

Each local calendar date has a deterministic target between 0.5 and 10 seconds. A player receives one official attempt for the current date. Official results persist and the UI encourages the player to return tomorrow.

After completing today's challenge, the Daily screen shows:
- Guess, target and error
- Global leaderboard placement when Supabase is configured
- Best score today when leaderboard data is available
- Clock Rating participation bonus, current streak and tomorrow's reward
- A live countdown to the next local calendar day
- A link to Challenge Archive on the Daily hub

Daily Challenge uses Supabase for the real global leaderboard when both `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are present. If either variable is missing, leaderboard functionality is disabled gracefully and leaderboard UI is hidden. The app uses the existing `daily_submissions` table with `id`, `challenge_date`, `player_id`, `display_name`, `error`, `guess` and `created_at`.

A random `player_id` is generated once per device, stored locally and reused forever. Daily leaderboard submissions use the locally stored display name, defaulting safely to `Anonymous` if none has been set. The display name can be changed later in Settings.

Only today's official Daily Challenge submits to Supabase. Archived days are view-only and must never submit. The app checks for an existing submission for the same `challenge_date` and `player_id`; if one already exists, it fetches and displays the existing placement instead of submitting again. Submissions include `challenge_date`, `player_id`, `display_name`, `error` and `guess`. The leaderboard fetch includes the player's global rank, total players today, best score today and top 10 entries, but the normal UI keeps the result focused on global rank and best score.

Challenge Archive is view-only and currently lists the previous 14 local calendar dates. Every item shows its date, deterministic secret time and whether it was played. Played entries show the official error; missed entries say `Not played`. Archived challenges cannot be replayed or submitted because their secret times are already known.

Official Daily attempts update general gameplay stats. Completing today's challenge awards a once-per-day Clock Rating participation bonus regardless of accuracy. The challenge's accuracy itself does not produce a ranked gain or loss.

Daily completion streak rewards:
- Day 1: +10 Clock Rating
- Day 2: +15
- Day 3: +20
- Day 4: +30
- Day 5: +40
- Day 6: +50
- Day 7: +60
- Day 8: +75
- Day 9: +90
- Day 10 and every maintained day thereafter: +100

The active streak, last completed date and claimed dates persist locally. Missing a local calendar day resets the next completion to Day 1. A live `HH:MM:SS` countdown on the Time Guesser Daily card, Daily hub and Daily result counts down to the user's next local midnight.

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
- Level 1 targets 1.00 second, Level 2 targets 2.00 seconds, continuing through Level 20 at 20.00 seconds.
- The player explicitly starts and stops the timer using the controls or Space bar.
- START and STOP use the same large centered circular control and screen position.
- The timer is hidden while running.
- The player must stop within ±0.25 seconds of the target, inclusive, to progress.
- One miss ends the run.
- Completing Level 20 completes the ladder.

The highest successfully cleared level persists in localStorage and is shown on the Home, Time Ladder and Stats screens. Time Ladder renders all 20 levels as one continuously mounted vertical tower. There is no surrounding box, rail artwork or background. Every rung remains rendered throughout movement; the stage's vertical mask alone determines when a step enters or leaves view, so rungs cross the top and bottom boundaries smoothly rather than being toggled invisible. The bottom mask sits immediately above the timer circle and allows extra horizontal room for result feedback. Rungs use nearly the full available card width while preserving safe scale-animation clearance and the unchanged timer circle. Stable rung DOM nodes are never replaced between levels. Framer Motion animates only the tower container's `translateY`, centering the current rung over approximately 0.75 seconds with ease-in/out movement. There is no opacity transition. Reduced Motion sets the movement duration to zero. The current rung shows the target and, after a stop, the actual time, difference and pass/fail result inline rather than opening a separate result screen.

Time Ladder is fitted into the shared responsive card without internal scrolling in normal phone layouts. Its ladder visualization has a fixed-height stage so inline result details never shift the circular control. The animated tower ignores pointer input and the circle sits in a higher interaction layer, making the entire visible circle clickable. The largest practical circle remains in exactly the same position for START, STOP, advancing and resetting after failure. Ready-to-start is green, active STOP is red, and post-result actions including NEW RUN remain purple. Choosing NEW RUN after a failure above Level 1 reveals the intermediate rungs and smoothly rewinds the tower to Level 1 inside the masked upper stage; it never scrolls across the circle or lower navigation. Reduced Motion and completion resets move instantly. A second press starts the new timer. Space provides the same two-step behavior. The header states the ±0.25-second tolerance, and the final rung is labelled as the 20.00-second final step rather than a generic top marker.

Completed rungs remain visible in teal, future rungs are dimmed and the focused rung receives a subtle scale treatment. Framer Motion supplies one-shot success pulse, failure shake and best-level feedback outside the active timing window. No repeating or rhythmic animation runs during the active timer. Completing all 20 levels triggers a full-card trophy, layered confetti, enhanced celebration sound and haptic sequence. Saved and operating-system reduced-motion preferences make Ladder movement and feedback instant.

## Game 3: Hardcore Mode

Hardcore Mode is an endless arcade stop-the-clock game. It never affects Clock Rating or the general Time Guesser accuracy stats.

Each run starts with three lives. Before every round, the target is clearly shown. The player explicitly starts and stops the hidden timer using the controls or Space bar. A successful stop adds one point; a miss removes one life. The run ends at zero lives.

Targets are rounded to two decimals and generated by current score:
- Score 0–4: 1.00–4.00 seconds
- Score 5–9: 2.00–7.00 seconds
- Score 10+: 1.00–10.00 seconds

Difficulties and tolerances:
- Easy: ±1.00 second; unlocked by default
- Medium: ±0.50 seconds; unlocks after an Easy score of at least 3
- Hard: ±0.25 seconds; unlocks after a Medium score of at least 3
- Expert: ±0.10 seconds; unlocks after a Hard score of at least 3
- A mysterious `????` tier: ±0.50 seconds; unlocks after Expert reaches at least 3 and is revealed as GOD
- A second secret `????` tier: displayed error must be exactly 0.00 seconds; unlocks after GOD reaches at least 3 and is revealed as LITERAL CLOCK

Locked Medium, Hard and Expert cards remain visible and explain their unlock requirement. GOD and LITERAL CLOCK are visible as secret question-mark tiers until their respective prerequisites are met. Before GOD is revealed, LITERAL CLOCK's requirement says `Score 3 on ????`; it names GOD only after GOD is unlocked. Best scores persist independently for every difficulty.

All six difficulty cards fit on the standard selection screen using a compact two-column grid where space allows. The difficulty grid becomes internally scrollable only when smaller mobile browser/app viewports genuinely need it, without extra bottom padding or a visible scrollbar when every difficulty is already visible. Locked cards use explicit lock badges and dashed/high-contrast treatment. Clicking one shows a short dismissible explanation of its prerequisite. Hover states do not scale or clip, and Hard uses a readable red treatment.

Crossing an unlock score shows a compact dismissible top toast which slides in from above, closes automatically after a few seconds and slides back upward without covering the Score/Lives HUD. Hardcore START and STOP use the same large centered circular control and position. Their full circular surfaces are explicit interaction layers so decorative content cannot intercept clicks. Space advances from a result to the next target and starts another run from game over. During a Hardcore run/result/game-over screen, the bottom action area includes Change Difficulty above All Games so players can return directly to difficulty selection.

During a Hardcore run, Score and Lives appear as clearly labelled, unboxed HUD groups. The score uses a large numeral. Three larger hearts animate with Framer Motion when a life is lost; Reduced Motion changes directly to the depleted state.

Reaching zero lives plays a short descending run-over sound when sounds are enabled.

Hardcore STOP is always red, regardless of selected difficulty.

Difficulty themes progress from calm teal through amber, red and dark purple to a black/gold GOD theme and stark black LITERAL CLOCK theme. Ambient styling is visual only, provides no timing information and respects reduced-motion behavior.

The Home Hardcore card uses the skull icon. Dark mode must preserve readable foreground/background contrast across every Hardcore difficulty as well as the shared game cards.

## Clock Rating and Ranks

Clock Rating starts at zero and cannot fall below zero. Skill-based rating changes only after ranked Single Player Time Guesser guesses; the once-daily participation reward is the sole non-ranked bonus.

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

Clock Rating is unaffected by Casual Single Player, Party Mode, Time Ladder and Hardcore Mode. Daily Challenge performance never changes rating, but completing the current official challenge awards its once-per-day streak bonus. Archived days cannot award rating.

## Settings

Settings persist in localStorage. Current settings:
- Sounds
- Theme music
- Music volume
- Haptic feedback
- Reduced motion
- Dark mode
- Party timer range
- Daily leaderboard display name

Countdown length and high contrast are not configurable. Time Guesser uses its fixed 3-second countdown. Time Ladder and Hardcore use explicit Start/Stop timer controls with no countdown. Larger Controls is not currently implemented and is not reintroduced.

The operating system reduced-motion preference is respected in addition to the saved setting.

Music is optional, defaults on at 35% volume and loops the bundled theme at `public/audio/themev3.mp3`. Playback is gesture-unlocked so desktop, Android and iOS autoplay rules are respected. Its volume is controlled by a persisted 0-100% slider in Settings and the implementation uses a Web Audio gain node where available so volume and fades work more reliably across native wrappers and mobile browsers. The theme behaves like waiting music: during active timing and guess-entry states it slowly fades down over about 5 seconds instead of stopping abruptly. It does not fade back in during any guessing element. After the game reaches a result or menu state, it waits about 10 seconds and then fades back in over about 5 seconds. Turning Music off mutes the track without resetting it to the start; when technically possible the track continues progressing silently and resumes from its current position when re-enabled.

Turning Haptic Feedback on immediately triggers a short confirmation buzz through the shared haptic system. Capacitor Haptics is used on native Android/iOS builds, with `navigator.vibrate` retained as a browser fallback.

## Input and Navigation UX

Numerical guess entry uses a shared custom in-app keypad instead of the native device keyboard. The keypad includes digits 0-9, decimal point, delete/backspace and a submit button. It accepts no more than two digits before and two digits after the decimal point and automatically inserts the decimal point once two whole-number digits have been typed. The keypad is used by Time Guesser Single Player, Daily Challenge and Standard Party guess entry, and is designed for future numeric entry screens.

Enter submits valid Single Player and Daily Challenge guesses through the custom keypad handler. In Party Mode, Enter saves the active player's valid guess and advances to the next player. Space starts and stops Time Ladder and Hardcore timers when focus is not inside another interactive control on desktop. Native/touch UI wording avoids keyboard-specific labels such as `Space`, while preserving the keyboard shortcut for desktop users.

Menu buttons provide short feedback tones when sounds are enabled. Gameplay retains countdown, stop and result tones plus optional haptics. Haptics are routed through `@capacitor/haptics` for native Android/iOS builds, with `navigator.vibrate` retained only as a browser fallback if Capacitor haptics are unavailable.

A Spot On result in any implemented game plays a celebration sound and shows confetti. Party result rows replace the error with `Spot On!`, and Spot On player names use gold treatment.

## Statistics

The Stats screen contains:
- Time Guesser: Clock Rating, current rank, games played, best accuracy, average error and Spot Ons
- Daily Challenge: best official Daily accuracy and official challenges completed
- Time Ladder: best ladder level
- Hardcore Mode: best Easy, Medium, Hard and Expert scores
- Hardcore GOD best only after GOD is unlocked or has a recorded score
- Hardcore LITERAL CLOCK best only after it is unlocked or has a recorded score

General accuracy stats include Single Player and official Daily Challenge attempts. Party Mode and Time Ladder are excluded. Errors of 100 seconds or more are excluded from average error to avoid accidental inputs skewing the result.

Stats reset clears Time Guesser accuracy stats and Clock Rating after confirmation. It does not clear Daily history or retention state, Time Ladder best or Hardcore best scores.

## Persistence

localStorage keys:
- `timegames-stats`: general accuracy stats, Clock Rating and average-error sample count
- `timegames-settings`: settings and ranked-mode preference
- `timegames-music-default-on-migrated`: one-time migration marker so older installs adopt the music-on default once without repeatedly overriding the user's choice
- `timegames-player-id`: randomly generated device-local Daily leaderboard identity
- `timegames-player-display-name`: locally stored Daily leaderboard display name
- `timegames-daily-results`: official Daily results keyed by local date
- `timegames-daily-retention`: current streak, last completed date and dates whose rating bonus was claimed
- `timegames-ladder-best`: highest successfully cleared Time Ladder level
- `timegames-hardcore-bests`: best Hardcore score for each difficulty

Party players and scores remain in React state only.

## UI Requirements

- Preserve the desktop 680px card feel and mobile-first maximum width.
- On mobile/native-sized screens, use the full available dynamic viewport height with safe-area padding and allow the app screen to scroll vertically when content cannot fit.
- Keep scrolling inside the app/cards without letting bottom actions overlap content. Any scrollable area above persistent bottom actions must include enough bottom padding for the action area and `safe-area-inset-bottom`.
- Shared secondary/navigation actions use a dedicated contrast-safe button treatment so dark mode stays readable after moving between result screens and menus. Safe-area spacing is reserved outside bottom buttons so labels and icons remain vertically centered inside the button.
- Result cards may remain internally scrollable but must hide their scrollbar so the Single Player reveal face stays clean.
- Screens with a bottom “All Games” action should not duplicate it with a top-left back button.
- Time Ladder and Hardcore selection/gameplay screens should fit without internal scrolling on normal phone sizes, but the global app viewport may scroll on especially small screens rather than clipping content.
- Preserve rounded cards and teal, indigo and rose accents.
- Preserve the result flip card, hidden-clock shimmer, Spot On glow and confetti.
- Time Guesser's reveal card flips horizontally from right to left.
- Preserve reduced-motion and dark-mode support.
- Avoid clipped fixed-card overflow; mobile screens may scroll cleanly inside the app viewport when needed.
- Native Android builds are locked to portrait orientation via the Android manifest. Native iOS builds are locked to vertical orientations via `Info.plist`. Tabletop Mode keeps that portrait lock and uses an internal horizontal board-style layout rather than OS-level landscape.

## Technical Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- lucide-react
- framer-motion
- @capacitor/haptics
- @supabase/supabase-js
- localStorage persistence

## Important Development Rules

- Preserve the Home → game hub structure.
- Preserve Time Guesser Single Player, Party Mode, Daily Challenge and view-only Challenge Archive.
- Preserve Time Ladder rules and persistence.
- Preserve Hardcore Mode rules, difficulty unlocks and persistence.
- Keep Time Ladder, Hardcore, Party and casual play isolated from Clock Rating; Daily may only award the documented once-per-day participation bonus.
- Preserve localStorage-backed settings and stats.
- Prefer focused components over continuing to enlarge `App.tsx`.
- Preserve existing animations and responsive app-card scrolling.
- Run `npm run build` after code changes and fix introduced TypeScript errors.
