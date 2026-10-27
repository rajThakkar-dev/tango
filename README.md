# Tango Unlimited

A free-to-host sun-and-moon logic game with deterministic daily puzzles and unlimited generated levels. Its compact gameplay interface follows the familiar conventions of the popular Tango puzzle while keeping the generator and application independent.

## Features

- Daily puzzle shared worldwide using a versioned UTC date seed
- Unlimited and numbered-level modes
- Easy, medium, and hard generation settings
- Deterministic seeded random generator
- Unique-solution validation for every generated puzzle
- Undo, clear, hint, timer, and optional auto-check
- Local statistics and daily streaks
- Responsive, accessible interface
- No backend, database, account, or paid API

## Local development

```bash
npm install
npm run dev
```

## Verification

```bash
npm test
npm run build
```

The production site is written to `dist/` and can be deployed as a static site to GitHub Pages, Cloudflare Pages, Netlify, or Vercel.

## How generation works

The generator creates a valid solved 6×6 board, derives `=` and `×` relationships from it, removes clues in a seeded order, and uses the solver after each removal to keep exactly one possible solution. The seed includes the game version, requested mode/level, and difficulty, so the same input always recreates the same puzzle.

Daily puzzles use `daily-YYYY-MM-DD`, where the date is UTC. This makes the daily challenge switch simultaneously worldwide without a server.

## Attribution

Moon icon by [Good Ware](https://www.flaticon.com/authors/good-ware) from [Flaticon](https://www.flaticon.com/free-icon/moon_702471), recolored and mirrored for the game interface. Used under the Flaticon free license with attribution.
