# TimeGames Agent Instructions

Always read docs/project-context.md before making changes.

This project is a React, TypeScript, Vite and Tailwind timing game.

Rules:

* Preserve Single Player.
* Preserve Party Mode.
* Preserve 10 Second Challenge.
* Preserve ranking system.
* Preserve localStorage settings and stats.
* Keep the fixed card layout.
* Avoid overflowing card heights.
* Preserve existing CSS animations.
* Prefer creating new components instead of making App.tsx larger.
* Run npm run build before finishing any task.
* Fix any TypeScript errors introduced by changes.

## Build Verification

After making any code changes:

1. Run:

```bash
npm run build
```

2. If the build fails:

   * Fix all errors.
   * Re-run the build.
   * Continue until the build succeeds.

3. Do not consider the task complete until:

```bash
npm run build
```

finishes successfully.

4. Include the build result in your final response.

5. If build execution is unavailable in the current environment, explicitly state that build verification could not be performed.
