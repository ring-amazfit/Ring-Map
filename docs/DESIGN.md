# Night Corridor Design

## Thesis

RingMap is a glanceable cycling instrument, not a miniature map. “Night Corridor” uses a real dark road surface, restrained cyan road-edge reflections, and a single amber reflection to establish direction without competing with the current action.

The generated background is original and contains no copied UI, text, logos, people, map tiles, bokeh blobs, or isolated gradient orbs.

## Watch themes

The watch offers three runtime-selectable backgrounds without rebuilding page layout:

- Night Corridor: the original road artwork
- Pure black: no bitmap background
- Navigation Mascot (导航娘): a circular crop from the project-owner-supplied character artwork, composited over black at restrained opacity

All themes retain the same text hierarchy and action colors.

## Watch palette

- Background: `#030507`
- Primary text: `#F6FAF8`
- Secondary text: `#B5C2C8`
- Muted text: `#6F7C83`
- Live signal: `#2EDCF2`
- Arrival/urgent: `#FF6E63`
- Reroute: `#FFC857`

User-provided Icons8 arrows keep their source colors. Shape and text always carry the maneuver meaning; color is not the sole signal.

## Round-screen grid

Design master: `480 x 480`. ZeppOS `px()` scales the same grid to 466px targets.

```text
y 24..46    source / connection
 y 54..84   maneuver title
 y 88..240  action image (152px)
 y246..334  distance (72px, optional 80px big mode)
 y340..372  instruction
 y378..402  road
 y408..428  freshness
 y434..452  session / protocol
```

Arrow, distance, instruction, and road slots do not intersect. Decorative road imagery can reach the bezel; semantic content stays in the round-screen safe area. Long instruction and road strings are truncated rather than wrapped into adjacent regions.

## States

- Waiting/connecting/confirming: text only, with no placeholder symbol or fake direction
- Connected/idle: bridge status and “等待导航”
- Active: source, maneuver, colored action, distance, instruction, road, sequence
- Partial: explicitly says it is waiting for complete maneuver information
- Stale: old action and distance are hidden
- Arrived: coral finish flag and arrival title

## Motion and haptics

Pages use ZeppOS route transitions. A navigation update replaces widgets once; backgrounds do not continuously animate. Balance may destroy the app on screen-off, so its teardown signals `watch_sleep`; App-Side then retains only the newest Android snapshot rather than enqueueing periodic notification refreshes over Bluetooth. Wake relaunch restores the fresh cached snapshot, automatically returns to the navigation page when the session is still active, and immediately performs `watch_ready` / resync reconciliation.

Haptics are global rather than page-owned:

- Off
- New instruction only
- New instruction plus 500/200/80m threshold crossings

Semantic haptic tokens prevent distance refreshes from vibrating repeatedly. An 8-second cooldown limits noisy notification bursts.

## Android companion

Android keeps Material 3 and Monet. The project-owner-supplied character artwork appears in framed Android status, navigation, and About media areas behind a fixed dark readability scrim, and as the optional low-opacity circular Navigation Mascot watch theme. Content surfaces remain readable in light or dark mode.

The four equal-priority destinations are Status, Navigation, Diagnostics, and Settings. Android uses the official Material Components `BottomNavigationView`: a full-width, shadowless 80dp M3 navigation bar, 24dp icons, dynamic Monet colors, and a 64 x 32dp active pill. There is no custom drag gesture, floating capsule, or parallel selection animator.

Root fragments are preloaded during idle time and then switched with `show`/`hide`, so repeated tab changes do not reinflate layouts. User-initiated root switches use the existing Material Components `MaterialSharedAxis.X` implementation with a short 180ms duration; About remains a secondary Settings destination.

The navigation timing section and launcher use the project-owner-supplied map marker. ZeppOS target icons are RGBA circles with transparent corners so round launchers do not expose a square plate.
