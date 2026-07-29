# Third-Party Notices

## Icons8 navigation arrows

RingMap includes selected arrow PNG assets supplied by the project owner and attributed to [Icons8](https://icons8.com/).

Selected original files are retained under `assets/icons-src/icons8/`. Normalized transparent derivatives are packaged as the corresponding `nav-*.png` files in each ZeppOS target and in the Android drawable resources.

Selected source files:

- `icons8-thick-arrow-pointing-up-100.png`
- `icons8-回复箭头-100.png`
- `icons8-前进箭头-100.png`
- `icons8-左2-100.png`
- `icons8-右2-100.png`
- `icons8-左上-100.png`
- `icons8-右上-100.png`
- `icons8-左下-100.png`
- `icons8-右下-100.png`
- `icons8-u-turn-to-left-100.png`
- `icons8-u-turn-to-right-100.png`

Copyright and trademark rights in these source icons remain with their respective owner. RingMap does not claim ownership of Icons8 artwork. Use and redistribution remain subject to the applicable Icons8 license; the project keeps an attribution link in the Android About page, the ZeppOS About page, and this repository.

## Project-owner-supplied visual assets

The character artwork in `assets/visual-src/user-character.png` and map-marker artwork in `assets/icons-src/user-app-icon.png` were supplied by the project owner for use in RingMap. Derived crops and circular icon variants are packaged in the Android and ZeppOS targets. RingMap does not claim authorship of these supplied works; any underlying rights remain with their respective owner, and redistribution requires the appropriate permission.

## RingMap original visual assets

The following assets are original RingMap project material rather than Icons8 derivatives:

- Night Corridor watch backgrounds (`night-corridor-bg.png`)
- Sharp-turn, keep-side, roundabout, merge, fork, exit, arrive, reroute, and wait icons
- GitHub QR code encoding `https://github.com/ring-amazfit/Ring-Map`

Original vector sources for supplemental actions are under `assets/icons-src/custom/`.

## Software dependencies

RingMap uses the following libraries through their normal package managers:

- AndroidX libraries, Apache License 2.0
- Google Material Components for Android, Apache License 2.0
- Java-WebSocket, MIT License
- ZeppOS Zeus CLI and ZeppOS runtime APIs, subject to Zepp developer terms

Dependency source code is not vendored into this repository except for standard Gradle wrapper files.
