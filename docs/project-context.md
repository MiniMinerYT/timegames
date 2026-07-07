# TimeGames Project Context

TimeGames is a React, TypeScript, Vite and Tailwind collection of focused time-based games. Its central theme is mastering the player's internal clock.

## Main Menu Flow

The Home screen is the top-level game collection. It contains:
- TimeGames title and clock logo
- Time Guesser card
- Time Ladder card
- Hardcore Mode card
- Daily Challenge card
- Compact half-width Stats and Settings cards

Home card descriptions are intentionally short and punchy so the mobile menu breathes. Time Guesser shows the current Ranked/Casual state, Time Ladder can show the saved best level, Hardcore can show the saved best score, Daily Challenge highlights completion/streak/reward state, Stats says `Progress` and Settings says `Tweak`. Time Guesser uses a stopwatch-style timer icon, Time Ladder uses a ladder icon and Hardcore uses a skull icon.

Party Mode and Single Player live inside Time Guesser. Daily Challenge is a top-level Home card because it is a primary retention feature; returning from the Daily Challenge flow goes back to Home.

Clock Rating and rank progress appear inside Time Guesser only because ranked Time Guesser is the only game that changes rating.

The Home Time Guesser card indicates whether Single Player is currently Ranked or Casual. Home and Time Guesser game cards use the same centered menu-card treatment, and each top-level game exposes an “All Games” return control.

Shared game-menu cards use a fixed icon column, centered text column and matching spacer column so icons align consistently. Time Guesser, Time Ladder and Hardcore use the same centered icon/title/tagline header structure.

The layout uses a responsive app-card system designed mobile-first rather than locked to one phone-sized rectangle. The app shell fills the available dynamic viewport with safe-area padding for phone status bars, Dynamic Island/notches and home indicators, then scales its width naturally from small phones through large phones and tablets. Small phones can use the full device frame, normal iPhones keep the familiar compact feel, and tablets receive a wider, more spacious shell instead of a tiny centered phone panel. Desktop-class fine-pointer screens keep the older compact `max-w-md`/680px card presentation so the web layout does not stretch horizontally. The HTML viewport uses `viewport-fit=cover` so iOS exposes safe-area insets correctly. On narrow phone screens the card itself fills the device frame and extends its light/dark background into the safe-area regions, avoiding mismatched top or bottom strips while keeping content padded away from notches and home indicators. Content-heavy screens keep key navigation controls outside their scrollable content so actions such as Back remain visible. Scrollable content uses `flex-1 min-h-0 overflow-y-auto` plus modest bottom padding for the action area and safe-area inset, so final settings and stats can scroll fully above persistent bottom controls without oversized blank overscroll gaps.

The app opens with a tap-to-start TimeGames splash sequence that matches the saved light/dark theme. While waiting, the clock logo, title, tagline and start prompt use a slow subtle wave/shake so the entry screen feels alive without becoming distracting. Tapping or pressing Enter/Space first pulls all text beneath the logo upward in one smooth motion until it becomes tiny and visually passes behind the higher-stacked clock icon, then the same splash clock icon immediately launches toward the actual measured center of the home header icon. The launch destination is measured and frozen at tap time so the moving icon does not re-target after it lands. During the first Home reveal, the Home header remains position-stable while the moving splash icon overlaps the real Home icon, its launch glow fades away, and the handoff crossfades so it feels like one continuous icon settling into place. The Home title, tagline and menu cards start tiny near the icon and quickly grow/drop down in a tight waterfall as if being released from the landed logo. The help question mark is excluded from the waterfall and fades in separately. Theme music attempts to autoplay on launch, and the start tap provides the fallback user gesture needed when platforms such as iOS/WebKit block audible autoplay until interaction. Reduced Motion shortens the sequence to simple state changes.

First-run onboarding uses contextual coachmarks rather than a wall-of-text tutorial. After the splash, the first visit to each major menu can trigger a short guided showcase for that actual screen. The Home guide first explains the main game cards, then its final step asks the player to tap Time Guesser; that highlighted tap performs the real navigation and the walkthrough continues inside Time Guesser. The Time Guesser guide follows the same pattern by explaining rank/casual/party context before its final step starts the first Single Player round. The coachmark system measures real UI elements marked with `data-guide-id`, scrolls them into view when needed, dims only the area outside the target, draws a bright target ring/zoom highlight, keeps the highlighted UI itself in focus, points to the element with an arrow and shows one concise explanation at a time. Mobile players can tap the overlay or the popup rectangle itself to advance normal explanation steps without reaching for the Next button. Steps that explicitly ask the player to tap a highlighted card cannot be skipped by tapping the popup; those taps are routed only through the real highlighted action so the flow feels like a guided walkthrough rather than a passive tooltip tour. Each guide still has progress dots plus Back, Next/Got it and close controls for precise navigation. Reduced Motion keeps the same structure but removes movement-heavy transitions.

Coachmark guides are currently defined for Home, Time Guesser, Daily Challenge, Time Ladder, Hardcore difficulty selection, Party setup, Stats and Time Guesser/Daily result screens. Settings deliberately does not have a first-run coachmark because the controls are self-explanatory and should not interrupt play. Guides are intentionally shown only on safe menu/explanation/result screens, not during active timing windows. The Home guide also sets the legacy `timegames-onboarding-seen` flag when completed, while all per-screen guide completions are stored in `timegames-screen-guides-seen`.

Top-level menu, game-hub, Stats and Settings screen changes use very subtle content-only transitions inside the app card. On desktop the rounded 680px card frame stays stationary; only the contents inside it animate. These one-shot transitions are intentionally gentle, are disabled during active timing windows and are also disabled by the saved or operating-system Reduced Motion preferences.

Menu screens expose a contextual question-mark button in the card's top-left corner. It remains the reusable reminder system for returning players: a short intro, a clear "Your goal" callout, numbered step cards and optional "Good to know" tips. This keeps first-run teaching and later reminders consistent without forcing the player through coachmarks again. The dialog animates in with Framer Motion, respects the available viewport and safe areas, keeps its X close control visible in the top-right, scrolls its body internally when necessary, closes from the backdrop or Escape key and supports light/dark themes. Active Time Guesser gameplay, timing, guess-entry and result screens hide the help control so it does not distract or overlap play. Time Ladder keeps its help entry available, and Hardcore keeps help visible on the difficulty-selection screen only. Help content is written as simple player-facing instructions rather than developer rules, with the goal of making every mode understandable to someone opening the app for the first time.

## Game 1: Time Guesser

Time Guesser is the original hidden-clock game. A hidden clock runs for a secret length of time and the player guesses how long it ran.

Its menu contains:
- Single Player, dynamically labelled Ranked or Casual
- Party Mode
- A locked Multiplayer placeholder labelled Coming Soon so the hub has room for future expansion without changing the structure

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

Time Guesser and Daily Challenge results use a cinematic reveal sequence inside the existing result card rather than a separate popup. In Time Guesser, the card first shows the player's guess, reveals the actual time below in staged suspense beats, then lands the final error result. In Daily Challenge, the known target stays in the smaller reference position and the player's stopped time is the value revealed with suspense. The player's reference value and the revealed time keep stable positions during the sequence, and the revealed digits sit inside a fixed-width slot so adding decimal places does not shift the layout. The cinematic owns the guess/stop and error display, so the post-reveal detail area prioritises rank, leaderboard, streak and action controls instead of duplicating those same numbers. Reveal pacing adapts to accuracy and is intentionally readable even for normal misses; results under 0.10 seconds off reveal much more slowly, and Spot On attempts build extra suspense so the player cannot immediately tell whether they are merely very close or perfect. If the answer is within 0.10 seconds and the first decimal matches the player's guess, the reveal deliberately slows before showing the second decimal to build a game-show style suspense beat. Opening the rank list from a completed result and returning does not replay the reveal animation or confetti; the completed result state is restored immediately. Final wording is short and punchy, such as `0.02s OFF`, `Unreal timing.` or `SPOT ON`, `Perfect timing.`.

The cinematic reveal uses Framer Motion for subtle slide, scale, fade and glow effects directly on the result face rather than inside a separate bordered panel, so the flip from guess entry into reveal stays clean and readable. The guess-entry and reveal faces use the transparent app-card treatment instead of bright inner white panels, with the keypad and large typed guess/stop value providing the focus before that value visually flows into the reveal. The guess-entry face intentionally avoids placeholder question marks or extra instructions so the typed value aligns with the cinematic opening beat. Close results receive stronger glow treatment, and Spot On uses a gold celebration treatment with the existing confetti/celebration language. Result sounds are moved into the reveal sequence rather than firing immediately on submission: small tick/pop tones play as the actual time is revealed, an impact tone lands with the final error, and Spot On triggers the unique celebration sting. Haptic feedback mirrors those reveal beats when enabled. Reduced Motion skips the suspense movement and immediately exposes the final result/details while preserving the normal result information.

In ranked results, the Clock Rating/rank progress card is interactive. Tapping it opens the full Clock Ranks list as a compact fitted panel without an internal scrolling rank section, and Back returns to the same revealed result screen rather than leaving the round summary.

Casual and ranked rounds update general stats. Only ranked rounds affect Clock Rating. The casual-result ranked control can enable or disable ranked mode for the next round.

### Troll Mode

Troll Mode is an optional prank variant launched directly from the Super Crazy section at the bottom of Settings. It first opens a neutral ready screen with a simple Start button so the device can be handed to someone else without exposing the joke. After Start, it uses the normal hidden-clock, countdown, guess-entry and reveal flow, but every result is presented as if it were Spot On. Consecutive fake perfects intentionally become less exciting and more suspicious; after roughly three in a row the celebration/copy becomes deliberately dull and the reveal loses colour to reveal the joke. The degradation resets each time Troll Mode is entered from Settings. Troll Mode is presentation-only and does not affect Clock Rating or competitive progression.

### Party Mode

Party Mode starts with a mode choice on mobile/native-sized builds:
- Standard Party Mode
- Tabletop Mode

Desktop/web pointer layouts may continue to show the standard scored Party flow only.

In Standard Party Mode, at least two players are required. After the fixed 3-second countdown and hidden clock, players enter guesses. Blank players are skipped.

Party guesses use the shared in-app number keypad rather than the native device keyboard. Selecting a player makes them active, but the keypad opens only when the player's guess box is tapped. Submitting a valid guess formats it, advances to the next player who still needs a guess and scrolls the active player into view. Desktop keyboard entry and Enter submission are preserved through the custom keypad handler.

The result ranks participating players by absolute error. Players within 0.005 seconds of the best error tie for first and each receive one point. The in-session scoreboard, players and scores are not persisted across reloads. Party Mode never affects Clock Rating or general stats.

Party results use the same flip-card reveal language as Time Guesser for the secret time before showing the ranked round outcome.

Tabletop Mode is a mobile-first Party variant for a group sitting around one device. It does not ask for player names, guesses or scores. Selecting Tabletop opens a dedicated Start Timer screen rather than immediately starting the timer. The countdown, hidden-timer ready state, stop prompt and reveal all use large rotated tabletop text so the content reads horizontally across a table while the app remains portrait-locked. After the hidden timer stops, the screen shows large question marks. The group can discuss the answer, then tap the reveal area to dramatically flip/reveal the secret time in very large but clamped type. After reveal, Play Again and Home are stacked on the right side of the rotated layout. Tabletop sound effects are deliberately louder than normal solo-play tones so the group can hear round state changes. Tabletop Mode uses the Party target range setting but never affects Clock Rating, stats or the scored Party leaderboard. The app remains portrait-locked globally; Tabletop does not force physical device landscape. Instead, its central content is rotated into a landscape-style layout inside the portrait shell so it reads well when the phone is placed on a table.

Party target ranges:
- Short: 2–6 seconds
- Standard: weighted standard target generation
- Long: 8–20 seconds

### Daily Challenge

Each local calendar date has a deterministic target between 1.5 and 10 seconds. A player receives one official attempt for the current date. The target is shown before play, then after the normal 3-second countdown the player must stop the hidden timer as close to that target as possible. Official results persist and the UI encourages the player to return tomorrow.

After completing today's challenge, the Daily screen shows:
- Stop time, target and error
- Global leaderboard placement when Supabase is configured, with stored/local fallback placement when available
- Best score today when leaderboard data is available
- A compact top-today leaderboard preview when Supabase top entries are available
- Clock Rating participation bonus, current streak and tomorrow's reward
- A live countdown to the next local calendar day
- A link to Challenge Archive on the Daily hub

Daily Challenge uses Supabase for the real global leaderboard when both `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are present. If either variable is missing, leaderboard functionality is disabled gracefully and leaderboard UI is hidden. The app uses the existing `daily_submissions` table with `id`, `challenge_date`, `player_id`, `display_name`, `error`, `guess` and `created_at`.

A random `player_id` is generated once per device, stored locally and reused forever. Daily leaderboard submissions use `Anonymous` for the required `display_name` table field; the app does not ask the player for a display name and only surfaces Daily placement/rank information.

Only today's official Daily Challenge submits to Supabase. Archived days are view-only and must never submit. The app checks for an existing submission for the same `challenge_date` and `player_id`; if one already exists, it fetches and displays the existing placement instead of submitting again. Submissions include `challenge_date`, `player_id`, `display_name`, `error` and `guess`, with `guess` storing the player's actual stop time and `display_name` sent as `Anonymous`. The leaderboard fetch includes the player's global rank, total players today, best score today and top 10 entries, but the normal UI keeps the result focused on global rank and best score. Today's leaderboard placement refreshes periodically while the app is open, with faster refreshes on Daily screens so returning to Daily Challenge shows the latest known placement.

Challenge Archive is view-only and currently lists the previous 14 local calendar dates. Every item shows its date and whether it was played. Played entries show the target, stop time, official error and placement data when available. Missed entries only show the `Not played` badge and do not reveal the target time, since Daily Challenge is now a stop-at-target mode and revealing unplayed targets would spoil the history. Archived challenges cannot be replayed or submitted.

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

The active streak, last completed date and claimed dates persist locally. Missing a local calendar day resets the next completion to Day 1. A live `HH:MM:SS` countdown on the Home Daily card, Daily hub and Daily result counts down to the user's next local midnight.

### Standard Target Generation

Single Player, standard Party rounds and Streamer Mode hidden-clock rounds use these weighted ranges:
- 48%: 4–8 seconds
- 20%: 3–6 seconds
- 20%: 8–10 seconds
- 8%: 1.5–3 seconds
- 3%: 10–15 seconds
- 1%: 15–20 seconds

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

Time Ladder keeps the game card itself fixed while only the ladder lane scrolls during and after a run. The lane contains the full tower from Level 20 at the top down to Level 1 at the bottom; initial Level 1 is positioned at the bottom of the scroll range with no downward empty space, and players can manually scroll upward to preview or review all the way to Level 20. Starting or advancing a run uses Framer Motion to animate the lane's scroll position so the active level returns to the focus position, while the large circle and bottom navigation remain outside the scroll area. Its ladder visualization has a fixed-height stage and every rung keeps the original compact thickness; pass/fail/Spot On details are compressed into a one-line detail inside the same step instead of changing rung height or causing a layout snap. The animated tower ignores pointer input and the circle sits in a higher interaction layer, making the entire visible circle clickable. Each rung stores the current run's actual stop time, difference and pass/fail result, allowing players to scroll back through previous level scores during the run or after dismissing the completion celebration. The largest practical circle remains in exactly the same position for START, STOP, advancing and resetting after failure. Ready-to-start is green, active STOP is red, and post-result actions including NEW RUN remain purple. Choosing NEW RUN after a failure above Level 1 smoothly scrolls the ladder lane back to Level 1 inside the upper stage; it never scrolls across the circle or lower navigation. Reduced Motion and completion resets move instantly. A second press starts the new timer. Space provides the same two-step behavior. The header states the ±0.25-second tolerance, and the final rung is labelled as the 20.00-second final step rather than a generic top marker.

Completed rungs remain visible in teal, future rungs are dimmed and the focused rung receives a subtle scale treatment. A Spot On rung keeps its normal readable fill but receives a yellow border/ring and triggers the shared Spot On celebration so it stands out from normal passes without turning the whole box yellow. Framer Motion supplies one-shot success pulse, failure shake and best-level feedback outside the active timing window. No repeating or rhythmic animation runs during the active timer. Completing all 20 levels triggers a full-card trophy, layered confetti, enhanced celebration sound and haptic sequence with an option to review the completed rung history. Saved and operating-system reduced-motion preferences make Ladder movement and feedback instant.

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
- A mysterious `????` tier: ±0.05 seconds; unlocks after Expert reaches at least 3 and is revealed as GOD
- A second secret `????` tier: displayed error must be exactly 0.00 seconds; unlocks after GOD reaches at least 3 and is revealed as LITERAL CLOCK

Locked Medium, Hard and Expert cards remain visible and explain their unlock requirement. GOD and LITERAL CLOCK are visible as secret question-mark tiers until their respective prerequisites are met. Before GOD is revealed, LITERAL CLOCK's requirement says `Score 3 on ????`; it names GOD only after GOD is unlocked. Best scores persist independently for every difficulty.

All six difficulty cards fit on the standard selection screen using a compact two-column grid where space allows. The difficulty grid becomes internally scrollable only when smaller mobile browser/app viewports genuinely need it, without extra bottom padding or a visible scrollbar when every difficulty is already visible. Locked cards use explicit lock badges and dashed/high-contrast treatment. Clicking one shows a short dismissible explanation of its prerequisite. Hover states do not scale or clip, and Hard uses a readable red treatment.

Crossing an unlock score shows a compact dismissible top toast which slides in from above, closes automatically after a few seconds and slides back upward without covering the Score/Lives HUD. Hardcore START and STOP use the same large centered circular control and position. Their full circular surfaces are explicit interaction layers so decorative content cannot intercept clicks. Space advances from a result to the next target and starts another run from game over. During a Hardcore run/result/game-over screen, the bottom action area includes Change Difficulty above All Games so players can return directly to difficulty selection.

During a Hardcore run, Score and Lives appear as clearly labelled, unboxed HUD groups. The score uses a large numeral. Three larger hearts animate with Framer Motion when a life is lost; Reduced Motion changes directly to the depleted state.

Reaching zero lives plays a short descending run-over sound when sounds are enabled.

Hardcore START is always green and STOP is always red, regardless of selected difficulty. Result feedback only shakes on failure/life-loss; passed rounds stay stable so success does not create an unnecessary screen wobble.

Difficulty themes progress from calm emerald/teal through orange, red and dark fuchsia/purple to a black/gold GOD theme and stark black LITERAL CLOCK theme. Cards and active screens use stronger, distinct color/effect treatments as difficulty increases while staying readable in light and dark mode. Expert and LITERAL CLOCK selection cards match their outline colours with stronger themed backgrounds. Ambient styling is visual only, provides no timing information and respects reduced-motion behavior.

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

Base gains by absolute error before rank-based scaling:
- Under 0.005 seconds: 260
- Under 0.05 seconds: 180
- Under 0.1 seconds: 115
- Under 0.25 seconds: 65
- Under 0.5 seconds: 48
- Under 1 second: 30
- Under 2 seconds: 18
- Under 3 seconds: 8
- 3 seconds or more: 0

Gains taper more aggressively at higher ratings so long-term progression is more competitive and Platinum/Diamond become natural settling ranks for many active players. Losses now begin from Gold Clock for errors of at least 2 seconds, scale by rank and miss severity, and can reach up to 60 points for severe high-rank misses.

Clock Rating is unaffected by Casual Single Player, Party Mode, Time Ladder and Hardcore Mode. Daily Challenge performance never changes rating, but completing the current official challenge awards its once-per-day streak bonus. Archived days cannot award rating. Ranking up shows the existing rank-up banner and plays a short celebratory chime when sounds are enabled.

## Settings

Settings persist in localStorage. Current settings:
- Sounds
- Theme music
- Music volume
- Haptic feedback
- Reduced motion
- Light mode toggle, inverted so off means the default dark theme is active
- Party timer range

Settings also includes a Super Crazy section near the bottom with a direct Start Troll Mode button. This opens the optional prank mode's neutral ready screen rather than toggling it into the Time Guesser menu.

New installs default to Dark Mode so the starfield/space presentation is the primary visual theme. The Settings switch is labelled Light Mode and is off by default; turning it on switches to the cleaner classic light theme.

Countdown length and high contrast are not configurable. Time Guesser uses its fixed 3-second countdown. Time Ladder and Hardcore use explicit Start/Stop timer controls with no countdown. Larger Controls is not currently implemented and is not reintroduced.

The operating system reduced-motion preference is respected in addition to the saved setting.

Music is optional, defaults on with the Settings slider at 50%, and loops the bundled theme at `public/audio/themev4.mp3`. The audible output is scaled below the raw slider value so the default feels quieter while still giving players useful control range. Playback is attempted on app load and still falls back to gesture-unlock when desktop/mobile autoplay rules block immediate playback. Its volume is controlled by a persisted 0-100% slider in Settings and the implementation uses a Web Audio gain node where available so volume and fades work more reliably across native wrappers and mobile browsers. The theme behaves like waiting music: during active timing and guess-entry states it slowly fades down over about 5 seconds instead of stopping abruptly. It does not fade back in during any guessing element. After the game reaches a result or non-home menu state, it waits about 10 seconds and then fades back in over about 5 seconds. Returning to Home or a main menu is treated as an eager waiting state, so the music resumes without the long post-game delay. Turning Music off immediately mutes and pauses the track without resetting it to the start; re-enabling resumes from the current position when playback is allowed. When the native/web app backgrounds, closes, hides, blurs or receives pause/pagehide/freeze lifecycle events, the music is muted, paused and the audio context is suspended so it does not continue playing behind iOS or Android.

The Music volume slider uses a larger custom thumb/track and horizontal touch handling so it is easier to grab on mobile without accidentally scrolling the Settings page. Slider movement updates the audible volume immediately when music is not ducked.

Turning Haptic Feedback on immediately triggers a short confirmation buzz through the shared haptic system. Capacitor Haptics is used on native Android/iOS builds, with `navigator.vibrate` retained as a browser fallback.

## Input and Navigation UX

Numerical guess entry uses a shared custom in-app keypad instead of the native device keyboard. The keypad includes digits 0-9, decimal point, delete/backspace and a submit button. It accepts no more than two digits before and two digits after the decimal point and automatically inserts the decimal point once two whole-number digits have been typed. The keypad is used by Time Guesser Single Player and Standard Party guess entry, and is designed for future numeric entry screens. Daily Challenge no longer uses numeric entry because it is now a stop-at-target mode.

Enter submits valid Single Player guesses through the custom keypad handler. In Party Mode, Enter saves the active player's valid guess and advances to the next player. Space starts and stops Daily Challenge, Time Ladder and Hardcore timers when focus is not inside another interactive control on desktop. Native/touch UI wording avoids keyboard-specific labels such as `Space`, while preserving the keyboard shortcut for desktop users.

Menu buttons provide short feedback tones when sounds are enabled. Gameplay retains countdown, stop and result tones plus optional haptics. Haptics are routed through `@capacitor/haptics` for native Android/iOS builds, with `navigator.vibrate` retained only as a browser fallback if Capacitor haptics are unavailable.

A Spot On result in any implemented game plays a celebration sound, shows confetti where that mode supports it and increments the shared Spot Ons stat. Party result rows replace the error with `Spot On!`, and Spot On player names use gold treatment.

## Statistics

The Stats screen contains:
- Global: total Spot Ons across implemented modes
- Time Guesser: Clock Rating, current rank, games played, best accuracy and average error. Best Accuracy is hidden once it reaches exactly 0.00 because Spot Ons are already tracked separately and a zero best becomes less meaningful as a statistic.
- Daily Challenge: best official Daily accuracy and official challenges completed
- Time Ladder: best ladder level
- Hardcore Mode: best Easy, Medium, Hard and Expert scores
- Hardcore GOD best only after GOD is unlocked or has a recorded score
- Hardcore LITERAL CLOCK best only after it is unlocked or has a recorded score
- Achievements, with unlocked/locked state for major milestones across Time Guesser, Daily Challenge, Time Ladder, Hardcore Mode and Clock Rating

General accuracy stats include Single Player and official Daily Challenge attempts. Party Mode and Time Ladder are excluded. Errors of 100 seconds or more are excluded from average error to avoid accidental inputs skewing the result.

Stats reset clears all local progress after confirmation, including Time Guesser accuracy stats, Clock Rating, Daily history/retention state, Time Ladder best level, Hardcore best scores/unlocks, achievements, current Party players, completed reveal state and first-run walkthrough flags so onboarding can run again.

Current achievements are intentionally lightweight local milestones:
- First Tick: complete a Time Guesser round
- Sharp Clock: finish within 0.10 seconds in a tracked guess
- Quarter Sense: finish within 0.25 seconds in a tracked guess
- Spot On: record at least one perfect result
- Warming Up: complete 10 tracked Time Guesser rounds
- Daily Habit: complete a Daily Challenge
- Clocking In: reach a 3 day Daily streak
- One Week Hot: reach a 7 day Daily streak
- Regular Ritual: complete 10 Daily Challenges
- Getting Higher: clear Level 5 in Time Ladder
- Halfway Up: clear Level 10 in Time Ladder
- Top of Time: complete the full Time Ladder
- New Pressure: unlock the first extra Hardcore difficulty
- Ten Lives Later: score 10 in any Hardcore difficulty
- ???: unlock the hidden Hardcore tier
- Silver Timing: reach Silver Clock in Ranked Time Guesser
- Chrono Master: reach 3000 Clock Rating

## Persistence

localStorage keys:
- `timegames-stats`: general accuracy stats, Clock Rating and average-error sample count
- `timegames-settings`: settings and ranked-mode preference
- `timegames-music-default-on-migrated`: one-time migration marker so older installs adopt the music-on default once without repeatedly overriding the user's choice
- `timegames-music-volume-default-migrated`: one-time migration marker so older installs using the previous untouched 35% music default move to the newer 50% slider default
- `timegames-player-id`: randomly generated device-local Daily leaderboard identity
- `timegames-daily-results`: official Daily results keyed by local date
- `timegames-daily-retention`: current streak, last completed date and dates whose rating bonus was claimed
- `timegames-ladder-best`: highest successfully cleared Time Ladder level
- `timegames-hardcore-bests`: best Hardcore score for each difficulty
- `timegames-achievements`: locally unlocked achievement ids
- `timegames-onboarding-seen`: first-run guide dismissal state
- `timegames-screen-guides-seen`: ids of contextual coachmark guides already completed on this device

Party players and scores remain in React state only.

## UI Requirements

- Prioritise the native mobile/tablet feel while preserving the compact desktop web card.
- Use the full available dynamic viewport height and safe-area padding, with a shell that grows from small phones to tablet widths instead of staying capped at a phone-sized rectangle.
- Keep scrolling inside the app/cards without letting bottom actions overlap content. Any scrollable area above persistent bottom actions must include enough bottom padding for the action area and `safe-area-inset-bottom`.
- Shared secondary/navigation actions use a dedicated contrast-safe button treatment so dark mode stays readable after moving between result screens and menus. Safe-area spacing is reserved outside bottom buttons so labels and icons remain vertically centered inside the button.
- Result cards may remain internally scrollable but must hide their scrollbar so the Single Player reveal face stays clean.
- Screens with a bottom “All Games” action should not duplicate it with a top-left back button.
- Time Ladder and Hardcore selection/gameplay screens should fit without internal scrolling on normal phone sizes, but the global app viewport may scroll on especially small screens rather than clipping content.
- Preserve rounded cards and teal, indigo and rose accents.
- Dark mode uses the same full-screen starfield backdrop language on the splash and main app. The star distribution is denser around the central gameplay area while still extending across the whole viewport, with occasional brighter shooting stars and subtle trails. The fixed game area itself is visually transparent in dark mode rather than an obvious solid rectangle, but it still constrains layout and scrolling. These particles pause during active timing windows and are disabled by Reduced Motion. Light mode keeps the cleaner classic light background without the starfield.
- Menu cards use a small press-scale response. Active timing gameplay must not use repeating or rhythmic animation that could help players count time.
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

## Current Implementation Map

The project has historically kept a large amount of UI state in `src/App.tsx`, but newer systems should continue moving toward focused helper files/components where practical.

Important files:
- `src/App.tsx`: top-level game state, navigation, Time Guesser, Daily Challenge, Party Mode, Stats, Settings, splash/onboarding wiring and shared app-shell flow.
- `src/CoachmarkOverlay.tsx`: contextual first-visit onboarding overlay that highlights real UI elements, points to them with arrows and advances through per-screen guide steps.
- `src/TimeLadder.tsx`: Time Ladder gameplay, ladder scroll/animation, rung results, completion celebration and Ladder persistence callbacks.
- `src/HardcoreMode.tsx`: Hardcore Mode gameplay, difficulty unlocks, difficulty themes, lives/score display and Hardcore persistence callbacks.
- `src/HelpOverlay.tsx`: reusable question-mark reminder modal used by menu/help screens. It supports intro, goal, numbered steps and tips.
- `src/NumberKeypad.tsx`: shared in-app numeric keypad used for guess entry instead of the native device keyboard.
- `src/AmbientMusic.tsx`: looping theme music, volume handling, duck/fade behaviour and gesture/autoplay fallback.
- `src/haptics.ts`: shared haptic helper using Capacitor Haptics where available with browser vibration fallback.
- `src/dailyLeaderboard.ts`: Supabase Daily Challenge submission/fetch helpers and leaderboard summary shape.
- `src/supabaseClient.ts`: environment-driven Supabase client creation using `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- `src/gameLogic.ts`: deterministic gameplay helpers for rank thresholds, rating changes, Daily Challenge target/reward logic, simulated Daily fallback placement and keypad sanitising.
- `src/achievements.ts`: local achievement definitions and unlock evaluation.
- `src/index.css`: global layout, safe-area handling, dark/light theme overrides, starfield/shooting-star effects, card styling and shared animation keyframes.
- `scripts/gameLogic.test.mjs`: dependency-free Node test harness for the extracted deterministic gameplay helpers.

Core deterministic gameplay helpers live in `src/gameLogic.ts` so rank thresholds, rating changes, Daily Challenge target/reward logic and keypad input sanitising can be verified outside the large UI component. `npm run test:logic` runs the small Node test harness against that source file. `npm run typecheck` runs the TypeScript compiler with the app config.

Current useful verification commands:
- `npm run test:logic`
- `npm run typecheck`
- `npm run build`

Known technical direction:
- Prefer new focused components/helpers over growing `App.tsx`.
- Keep animation logic outside active timing windows unless it is instantaneous or non-rhythmic.
- Keep backend leaderboard logic isolated behind `dailyLeaderboard.ts`/`supabaseClient.ts`.
- Preserve localStorage key compatibility when adding new persistence.
- Keep mobile/native layout and safe areas as the primary UI target while preserving the compact desktop card.

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
