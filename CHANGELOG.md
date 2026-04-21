# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-04-20

### Added

- OpenTelemetry span parser with GenAI semantic conventions and Langtrace support
- Generic JSON log parser for custom structured logs
- Mastermind event parser (reference implementation)
- `FlowGraph` component with SVG bezier connectors and glow effects
- `DetailPanel` component with collapsible JSON sections
- `Controls` component with transport buttons, scrubber, and speed selector
- `ReplayViewer` all-in-one component
- `useReplayPlayback` hook with timing-aware playback
- Parallel execution detection and fan-out/fan-in visualization
- CSS custom property theming system (`--afr-*`) with light/dark support
- Default stylesheet importable via `agentrace/styles`
- Rich agent context: system prompts, tool definitions, conversation history
- Keyboard shortcuts: Space (play/pause), Left/Right arrows (step)
