<!--
Title: a Conventional Commit header, e.g. `feat: set the split divider color`.
PRs are squash-merged and the title becomes the commit on main: lowercase,
imperative, 72 characters at most (aim for 50).

Agents: keep every heading. Tick a box only for a command you ran in this
branch; otherwise leave it unticked and say why below it.
-->

## What and why

<!-- What changes and the problem it solves. Link the issue: `Closes #123`. -->

## Checks

- [ ] `pnpm lint && pnpm typecheck`
- [ ] `pnpm check` (`themes/mistpine` matches the generator and the spec)
- [ ] `pnpm verify` with Ghostty <!-- version --> (CI runs it too)

## Colors

- [ ] `themes/mistpine` comes from `pnpm generate`, not edits by hand
- [ ] Every key maps to a spec token; color changes go to mistpine first
- [ ] New keys note the Ghostty version that added them in the README

## Screenshots

<!-- Before and after for any visible change. `pnpm render` regenerates the
README screenshots. Delete if nothing visible changed. -->

## Authorship

<!-- Tick one. If an agent took part, name it and the model. -->

- [ ] Written by a person
- [ ] Written with an AI agent; a person reviewed every change
- [ ] Written by an AI agent without line-by-line human review
