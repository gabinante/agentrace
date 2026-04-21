# Contributing to agentrace

Thanks for your interest in contributing! This guide will help you get started.

## Development Setup

```bash
git clone https://github.com/gabinante/agentrace
cd agentrace
npm install
npm run dev    # Opens demo at localhost:5173
```

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start demo dev server |
| `npm run build` | Build library with tsup |
| `npm run typecheck` | Run TypeScript type checker |
| `npm run lint` | Lint source files with ESLint |
| `npm run format` | Format source files with Prettier |
| `npm run format:check` | Check formatting without writing |
| `npm test` | Run tests with Vitest |
| `npm run test:watch` | Run tests in watch mode |

## Code Style

- **Formatting:** Prettier handles all formatting. Run `npm run format` before committing.
- **Linting:** ESLint with TypeScript rules. Run `npm run lint` to check.
- **Types:** All code is TypeScript with strict mode. Run `npm run typecheck`.

## Project Structure

```
src/
  components/   # React components (FlowGraph, DetailPanel, Controls, ReplayViewer)
  hooks/        # React hooks (useReplayPlayback)
  parsers/      # Log format parsers (OTel, generic JSON, Mastermind)
  styles/       # Default CSS theme
  types/        # TypeScript type definitions
  utils/        # Shared utilities (parallel detection)
demo/           # Demo app (not published to npm)
```

## Writing a Parser

Parsers convert log formats into `ReplayStep[]`. See `src/parsers/generic.ts` for the simplest example.

1. Create `src/parsers/myformat.ts`
2. Export a function that returns `ReplayStep[]`
3. Call `detectParallelGroups(steps)` before returning
4. Add exports to `src/parsers/index.ts` and `src/index.ts`
5. Add tests in `src/parsers/__tests__/myformat.test.ts`

## Writing Components

- All styles are inline `React.CSSProperties` using `var(--afr-*)` CSS custom properties with fallbacks
- No CSS-in-JS libraries — keeps the library zero-dependency
- Add `aria-label` and semantic HTML for accessibility
- Components should work without any CSS imports (fallback values handle this)

## Pull Requests

1. Branch from `main`
2. Make your changes
3. Run `npm run typecheck && npm run lint && npm test && npm run build`
4. Open a PR with a description of what changed and why
5. CI will run automatically

## Reporting Issues

Use [GitHub Issues](https://github.com/gabinante/agentrace/issues) for bug reports and feature requests.
