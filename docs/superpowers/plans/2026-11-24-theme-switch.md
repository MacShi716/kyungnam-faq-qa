# Day-night theme switch plan

Spec: `docs/superpowers/specs/2026-11-24-theme-switch.md`

## Files

- `index.html` — header switch, theme tokens, drag and keyboard behavior, bilingual name
- `tests/page.spec.mjs` — interaction, persistence, motion, and layout coverage
- No FAQ data, relay, or dependency changes

## Steps

1. Add light-theme tokens that match the current colors, plus a `html[data-theme="dark"]` override.
2. Place one switch in the header actions, before the language group, and let the header wrap on narrow screens.
3. Draw the crescent and sun with inline SVG rectangles. Drive both states from `--pos`.
4. Restore a saved theme or the system theme before paint. Commit clicks, keys, and completed drags to `faq_theme`.
5. Treat a horizontal move past 10px as a drag, a vertical move as scrolling, and Escape or pointer cancel as a revert.
6. Turn transitions off for reduced motion and while a drag is active.

## Tests

Browser tests keep AI calls mocked or avoided. They run under the existing reduced-motion default unless a case opts into motion.

- Click, Space, Enter, ArrowLeft, and ArrowRight reach the same light and dark states as a completed drag.
- Drag right commits day. Drag left commits night. A short horizontal drag snaps back. A vertical drag does not change the theme.
- Pointer cancel and Escape restore the state from pointer down.
- Reload keeps `faq_theme`. An unsaved page follows the system scheme until a choice is saved.
- Chinese and Korean accessible names, plus `aria-checked`.
- Reduced motion reports no thumb transition. Motion allowed reports a non-zero transition.
- Widths 375, 390, 1024×712, and 1024×480: the switch, language control, clear button, header, and composer do not overlap, and the page does not scroll sideways.
- A known FAQ question still renders in the dark theme.

## Evidence

Desktop and mobile screenshots of day and night, plus one contact sheet, saved outside the repository. No production deploy.
