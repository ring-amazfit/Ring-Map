# Night Corridor Design

## Thesis

RingMap is a glanceable cycling instrument, not a miniature map. “Night Corridor” uses a real dark road surface, restrained cyan road-edge reflections, and a single amber reflection to establish direction without competing with the current action.

The generated background is original and contains no copied UI, text, logos, people, map tiles, bokeh blobs, or isolated gradient orbs.

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
 y 58..92   maneuver title
 y100..228  action image (128px)
 y246..334  distance (72px, optional 80px big mode)
 y340..372  instruction
 y378..402  road
 y408..428  freshness
 y434..452  session / protocol
```

Arrow, distance, instruction, and road slots do not intersect. Decorative road imagery can reach the bezel; semantic content stays in the round-screen safe area. Long instruction and road strings are truncated rather than wrapped into adjacent regions.

## States

- Waiting: pause icon, no fake straight arrow
- Connected/idle: bridge status and “等待导航”
- Active: source, maneuver, colored action, distance, instruction, road, sequence
- Partial: explicitly says it is waiting for complete maneuver information
- Stale: old action and distance are hidden
- Arrived: coral finish flag and arrival title

## Motion and haptics

Pages use ZeppOS route transitions. A navigation update replaces widgets once; backgrounds do not continuously animate.

Haptics are global rather than page-owned:

- Off
- New instruction only
- New instruction plus 500/200/80m threshold crossings

Semantic haptic tokens prevent distance refreshes from vibrating repeatedly. An 8-second cooldown limits noisy notification bursts.

## Android companion

Android keeps Material 3 and Monet. The project-owner-supplied character artwork appears only in framed status, navigation, and About media areas behind a fixed dark readability scrim; content surfaces remain system-colored and readable in light or dark mode. Night Corridor remains the watch navigation background.

The four equal-priority destinations are Status, Navigation, Diagnostics, and Settings. Android uses the official Material Components `BottomNavigationView`: a full-width, shadowless 80dp M3 navigation bar, 24dp icons, dynamic Monet colors, and a 64 x 32dp active pill. There is no custom drag gesture, floating capsule, or parallel selection animator.

Root fragments are preloaded during idle time and then switched with `show`/`hide`, so repeated tab changes do not reinflate layouts or stack page transitions. About remains a secondary Settings destination and uses Shared Axis X.

The navigation timing section and launcher use the project-owner-supplied map marker. ZeppOS target icons are RGBA circles with transparent corners so round launchers do not expose a square plate.
