# ANTHBOT Dashboard Card

A modern Home Assistant Lovelace dashboard card for the [ANTHBOT Map](https://github.com/Mqbretrofit/ha-anthbot-map-v2) integration.

> Early development version. The dashboard is intentionally kept in a separate repository so the stable ANTHBOT Map integration and its model-specific Genie / M-series / N8 routing remain untouched.

## Goals

- large Hero-style ANTHBOT map
- floating live mower status
- battery, RTK, progress, cutting height, area and mowing-time chips
- Start / Pause / Resume / Dock / Stop controls
- strict per-mower entity scoping using `serial_number`
- reuse the proven ANTHBOT Map renderer instead of duplicating map decoding/calibration logic
- Home Assistant visual editor and additional layouts in later versions

## Requirements

- Home Assistant
- ANTHBOT Map integration installed and configured
- the bundled `custom:anthbot-map-card` frontend resource from ANTHBOT Map available

## Minimal configuration

```yaml
type: custom:anthbot-dashboard-card
entity: sensor.YOUR_MOWER_map
name: ANTHBOT
```

The `entity` must be the ANTHBOT Map entity for the mower, normally ending in `_map`.

## Architecture

The dashboard is a separate frontend project. It embeds the existing ANTHBOT map card in map-only mode and adds its own Hero dashboard UI on top. Mower commands continue to go through the `anthbot_map` Home Assistant services and include the mower serial when available.

This avoids copying or replacing the proven map renderer and keeps the integration responsible for model-specific behavior.

## Development status

Initial Hero Dashboard implementation is under active development.
