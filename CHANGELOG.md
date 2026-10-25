# Changelog

What changed in each release of House Control. The Mac app is on
[Releases](https://github.com/0xProbabillity/house-control/releases); the iPhone app is on TestFlight.

## 1.0.5 — 2026-10-25

### Brand & Platform Identity Update (Xhome)

- **Brand Evolution**: Renamed application to **Xhome** across all platforms (macOS desktop app and iOS mobile app).
- **Android Platform Support**: Added native Android shell module with hardware-accelerated WebView, LAN local networking, and standalone APK packaging pipeline.
- **Unified Controls & Widgets**: Updated widget identifiers, bundle naming, and app group configurations for seamless cross-device synchronization.
- **Release Automation**: Updated packaging pipelines and GitHub release workflows to output native `Xhome-<version>.dmg` and `Xhome-<version>.apk` packages.
- **Enhanced Updater**: Pointed in-app update notifications and changelog links to the official repository.

## 1.0.4 — 2026-10-18

### Bilingual Localization (Vietnamese & English)

- **Comprehensive Bilingual Support**: Full bilingual support (Tiếng Việt & English) across all app components, automatically adapting to system locale or user preference.
- **Language Switcher**: Added in-app language switching directly within the floor plan menu with real-time interface reload.
- **Web & 3D Control Panel**: All menus, climate controls (AC modes, fan speeds, air swing, sleep, eco), light controls, and comfort metric indicators fully translated.
- **Notch Island**: Localized status indicators, climate mode labels, and device announcement badges.
- **Native macOS & iOS Experience**: Menu bar extra, system alerts, update dialogs, iPhone pairing screens, and iOS settings localized in Vietnamese and English.

## 1.0.3 — 2026-10-18

### Notch Island toggle controls

- **Control panel toggle button**: Added a dedicated Notch Island toggle button on the header of the main control panel, indicating live status with a glowing active state.
- **Settings menu toggle**: Added "Hide Notch Island" / "Show Notch Island" in the Floor Plan dropdown menu.
- **Island header quick-hide**: Added a hide button directly inside the expanded Notch Island header for immediate dismissal.
- **Two-way synchronization**: Toggling island state instantly syncs across native macOS window state, web panel controls, and persistent user defaults.

## 1.0.2 — 2026-10-18

### Notch Island sizing & in-app updates

- **Compact Notch Island**: Ears now size dynamically and asymmetrically based on active content (collapsing empty sides to 0px and shrinking left ear to 36px), preventing the island from covering neighboring menu bar items and status icons.
- **Auto-centered cutout**: Hardware camera cutout remains centered regardless of asymmetrical ear widths.
- **In-app update notifications**: Mac app periodically checks GitHub releases in the background and notifies when a newer DMG is available with quick download & release note previews.
- **Manual check for updates**: Added "Check for Updates..." to the menu bar extra and update prompt banner in the web control panel.

## 1.0.1 — 2026-10-18

### Room sensors

- Temperature and humidity sensors can now be added to a room as independent devices instead of only serving as an
  air conditioner's thermometer.
- Sensor tiles show live temperature, humidity, battery level and offline state in the Mac and iPhone control panels.
- The floor-plan editor and the iPhone Devices screen can add, link and move room sensors while preserving an AC's
  existing thermometer link.
- Smart Life sensor readings now include humidity and battery data when the device reports them.

## 1.0.0 — 2026-10-15

### Widgets, controls and quick actions

- **Widgets** for the iPhone's Home Screen, Lock Screen and StandBy, and for the Mac's desktop: Home in 3D,
  Scenes, Light, Room, Climate and Home Status.
- **Control Center controls** on the iPhone: All Lights, a Light, a Scene and an Air Conditioner.
- **Quick actions** on the iPhone's app icon, chosen in Settings.
- Every widget is live: tap a lamp, a scene or an AC and it switches without opening the app. On the Mac the app in
  the menu bar carries it out; on the iPhone the widget talks to Home Assistant, Hue and Smart Life itself.
  See [docs/widgets.md](https://github.com/0xProbabillity/house-control/blob/main/docs/widgets.md).

### An iPhone app that needs no Mac

- **Floor plan editor on the phone:** the Mac's editor laid out for a finger — tap to select, drag what is selected,
  pan, pinch to zoom, details in a sheet from the bottom. **New home** starts from one room or a demo layout.
- **Home Assistant and Philips Hue** screens on the phone; servers and bridges on the Wi-Fi are found by themselves.
- **Devices:** link each lamp and AC to a real device from one searchable list, or add several devices to a room
  already linked.
- **Smart Life on a single phone:** save the sign-in code to Photos and scan it from the Smart Life app.
- **Sync both ways.** A paired Mac is optional. Plans edited on either side reach the other, and so do Home Assistant
  and Hue connections (the newest wins, a disconnect included). If both changed the plan while apart, the phone
  asks which one to keep.

### Two iPhone editions

- **App Store edition:** Home Assistant, Philips Hue and Apple Home.
- **Smart Life edition:** all of that plus Smart Life / Tuya, for TestFlight and your own phone.
- Smart Life now lives in its own module (`HouseSmartLife`), linked only by the Mac app and the Smart Life
  edition. The two editions are separate apps and can sit on one phone.

### Also

- **About** links (website, privacy policy, support, source) on the iPhone and in the Mac's menu.
- The editor only offers the platforms the app has.
- A privacy manifest for the widgets.
- From this release on, every Mac disk image carries a build provenance attestation:
  `gh attestation verify HouseControl-1.0.0.dmg --repo 0xProbabillity/house-control`
  ([#5](https://github.com/0xProbabillity/house-control/issues/5)).

### Fixed

- The iPhone never found Hue Bridges or Home Assistant servers on the network: iOS only browses the Bonjour types an
  app declares, and those two were missing.
- Widgets could jump back to an older state when the app started with widget taps still queued.

## 0.1.0 — 2026-10-14

The first public release: the home as a live 3D model in the Mac menu bar and on the iPhone, the island under the
notch, the floor plan editor, AI Access, and Smart Life, Home Assistant, Philips Hue and Apple Home.

This image was built while the repository was still private, so it has no build provenance attestation — only its
SHA-256 can be checked.
