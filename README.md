# ANTHBOT Dashboard Card

A modern Home Assistant Lovelace dashboard card for the [ANTHBOT Map](https://github.com/Mqbretrofit/ha-anthbot-map-v2) integration.

> Early development version. The dashboard is intentionally kept in a separate repository so the stable ANTHBOT Map integration and its model-specific Genie / M-series / N8 routing remain untouched.

## Current Hero Dashboard

The first test build already provides:

- large Hero-style ANTHBOT map
- the proven ANTHBOT Map renderer embedded in map-only mode
- floating mower name and live mower status
- circular battery indicator
- serial-scoped battery, status, RTK, progress, cutting-height, mowing-area and mowing-time chips
- live mowing progress bar
- dynamic Start / Pause / Resume primary control
- Dock and Stop controls that remain available as safety actions
- Home Assistant service calls through the existing `anthbot_map` integration
- `serial_number` included in commands whenever the map entity provides it
- mobile-responsive layout

## Requirements

- Home Assistant
- ANTHBOT Map integration installed and configured
- the bundled `custom:anthbot-map-card` frontend resource from ANTHBOT Map available

## Test installation with HACS

This repository is prepared as a HACS frontend/dashboard custom repository.

1. Add `https://github.com/Mqbretrofit/anthbot-dashboard-card` as a custom HACS Dashboard/Lovelace repository.
2. Install **ANTHBOT Dashboard Card**.
3. Reload Home Assistant frontend resources / refresh the browser if HACS asks for it.
4. Add a Manual card with the configuration below.

## Minimal configuration

```yaml
type: custom:anthbot-dashboard-card
entity: sensor.YOUR_MOWER_map
name: ANTHBOT
```

The `entity` must be the ANTHBOT Map entity for the mower, normally ending in `_map`.

## Optional configuration

```yaml
type: custom:anthbot-dashboard-card
entity: sensor.YOUR_MOWER_map
name: M9 Pro
height: 650
show_chips: true
chips:
  - battery
  - status
  - rtk
  - progress
  - height
  - area
  - time
```

The dashboard can also pass the existing ANTHBOT map presentation/calibration options through to the embedded map card, including `image`, `fit`, `rotation`, mobile map rotation/fit, overlay visibility and calibration settings.

## Architecture

The dashboard is a separate frontend project. It embeds the existing ANTHBOT map card in map-only mode and adds its own Hero dashboard UI on top. Mower commands continue to go through the `anthbot_map` Home Assistant services and include the mower serial when available.

This avoids copying or replacing the proven map renderer and keeps the integration responsible for model-specific behavior.

## Safety / compatibility

The dashboard does **not** replace ANTHBOT Map command routing or model adapters. Genie, M5/M9-family, M9 Pro and N8 behavior stays inside the existing ANTHBOT Map integration.

The first version intentionally starts only full-area mowing from the Hero primary button. Zone/edge target selection will be added on top of the existing integration capabilities rather than reimplementing mower protocols in this repository.

## Planned next steps

- zone / auto-zone / outer-edge target selector
- configurable status chips and action order
- Home Assistant visual card editor
- per-mower command lock and stronger command-confirmation UI
- smart Home Assistant update scoping
- additional compact/wide dashboard layouts
