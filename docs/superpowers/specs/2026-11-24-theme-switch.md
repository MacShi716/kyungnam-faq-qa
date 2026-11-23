# Day-night theme switch

## Goal

Add one compact header control to the existing FAQ page. It is a single switch with two states, not two buttons and not two designs. The thumb slides from the night end to the day end, and the switch appearance moves with it. Choosing a state changes the page between the current light theme and a dark theme. Questions, retrieval, AI requests, errors, and layout spacing stay as they are.

The reference is one control shown at its night end and its day end. This spec does not reproduce a video or any motion that was not supplied. The slide, snap, and short color change below are the approved interaction.

## States

Night, thumb at the left:

- Dark capsule track
- Translucent rounded-square glass thumb
- White pixel crescent drawn with inline SVG
- Cool blue-white rim and glow

Day, thumb at the right:

- Light capsule track
- White rounded-square glass thumb
- Dark pixel sun drawn with inline SVG
- Warm orange-yellow rim and glow

`--pos` runs from 0 at night to 1 at day. Track, glow, thumb fill, and the two icons follow that number. At 0.5 or more the committed page theme is light. Below 0.5 it is dark.

## Input

- Click or Space or Enter toggles the committed state.
- ArrowLeft commits night. ArrowRight commits day.
- Mouse and touch can drag the thumb. The first 10px choose the gesture. A mostly vertical move does not change the theme and does not block page scrolling. A mostly horizontal move drags `--pos` with the pointer.
- `touch-action: pan-y` on the switch lets the page scroll vertically. Pointer moves outside the switch do not start a drag.
- Release snaps to the nearer end. Escape or `pointercancel` during a drag restores the state from pointer down and does not write storage.
- A drag that commits suppresses the click that would otherwise toggle again.

## Persistence

The page has no theme storage today. Language storage stays `faq_ui_lang`.

- Saved `faq_theme` of `light` or `dark` wins on load and reload.
- With nothing saved, use `prefers-color-scheme`.
- A committed choice is saved. System changes apply only while nothing is saved.
- An inline script sets `data-theme` before paint. The switch script then sets `aria-checked` and `--pos`.

## Accessibility and motion

- The control is a button with `role="switch"`.
- Accessible name follows the UI language: Chinese `昼夜主题`, Korean `화면 테마`.
- `aria-checked="true"` means day. `false` means night.
- The hit target is at least 44px tall. The drawn track stays smaller than the header controls.
- Normal motion uses an 180ms transition on the thumb and theme colors.
- `prefers-reduced-motion: reduce` removes that transition. A drag still tracks the pointer directly.

## Page theme

Light keeps the current colors. Dark reuses the same layout with darker surfaces and light text so answers, badges, chips, and the composer stay readable. No remote fonts, icons, or images.

## Out of scope

FAQ text, confidence matching, the AI endpoint, error and retry copy, dock spacing, hosting, and any other repository.
