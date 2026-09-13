# ANTHBOT Dashboard Card

A modern Home Assistant Lovelace dashboard card for the [ANTHBOT Map](https://github.com/Mqbretrofit/ha-anthbot-map-v2) integration.

> Early development version. The dashboard is intentionally kept in a separate repository so the stable ANTHBOT Map integration and its model-specific Genie / M-series / N8 routing remain untouched.

## Current Hero Dashboard

The current test build provides:

- large Hero-style ANTHBOT map
- the proven ANTHBOT Map renderer embedded in map-only mode
- floating mower name and live mower status
- circular battery indicator
- serial-scoped battery, status, RTK, progress, cutting-height, mowing-area and mowing-time chips
- live mowing progress bar
- dynamic Start / Pause / Resume primary control
- mowing-target selector for **Full lawn**, **manual Zones**, **Auto zones**, **Outer edge** and **Dock area**
- multi-select manual and auto zones using the same IDs exposed by ANTHBOT Map
- Dock and Stop controls that remain available as safety actions
- Home Assistant service calls through the existing `anthbot_map` integration
- `serial_number` included in commands whenever the map entity provides it
- mobile-responsive layout
- Home Assistant **visual card editor** with live preview

The target selector uses the existing ANTHBOT Map service layer. It does not reimplement mower protocol commands. Manual zones are sent through `start_zone_mow`, auto zones through `start_auto_zone_mow`, outer-edge mowing through `start_outer_edge_mow`, and dock-area mowing through `start_dock_edge_mow`.

## Visual editor

After the card resource is loaded, choose **Edit dashboard → Add card → ANTHBOT Dashboard Card**. The card now exposes a native Lovelace visual editor; YAML is no longer required for the normal setup.

The visual editor currently includes:

- ANTHBOT Map entity picker
- dashboard title and height
- background/aerial image
- map fit and desktop/mobile rotation
- show/hide live status chips
- individual Battery / Status / RTK / Progress / Height / Area / Time chip selection
- show/hide mowing target selector
- boundary, zone, no-go-zone and no-go-label overlays

Every editor change emits Home Assistant's standard `config-changed` event, so the card preview updates while editing.

## Requirements

- Home Assistant
- ANTHBOT Map integration installed and configured
- the bundled `custom:anthbot-map-card` frontend resource from ANTHBOT Map available

## Test installation with HACS

This repository is prepared as a HACS frontend/dashboard custom repository.

1. Add `https://github.com/Mqbretrofit/anthbot-dashboard-card` as a custom HACS Dashboard/Lovelace repository.
2. Install **ANTHBOT Dashboard Card**.
3. Reload Home Assistant frontend resources / refresh the browser if HACS asks for it.
4. Add **ANTHBOT Dashboard Card** from the normal visual card picker and select the mower's ANTHBOT Map entity.

## Minimal YAML configuration

YAML remains supported when wanted:

```yaml
type: custom:anthbot-dashboard-card
entity: sensor.YOUR_MOWER_map
name: ANTHBOT
```

The `entity` must be the ANTHBOT Map entity for the mower, normally ending in `_map`.

## Optional YAML configuration

```yaml
type: custom:anthbot-dashboard-card
entity: sensor.YOUR_MOWER_map
name: M9 Pro
height: 650
show_chips: true
show_targets: true
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

Target availability comes from the current mower map data. Manual/auto zone buttons are only shown when those zones are actually present. Start is disabled until at least one zone is selected for zone mowing. Dock and Stop remain available while a normal command is pending.

## Planned next steps

- configurable action order and richer editor controls
- per-mower command lock and stronger command-confirmation UI
- smart Home Assistant update scoping
- additional compact/wide dashboard layouts
