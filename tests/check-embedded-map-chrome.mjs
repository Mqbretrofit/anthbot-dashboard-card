import fs from "node:fs";

const entry = fs.readFileSync("anthbot-dashboard-card.js", "utf8");
const core = fs.readFileSync("anthbot-dashboard-card-core.js", "utf8");

for (const token of [
  'import "./anthbot-dashboard-card-core.js"',
  ".map-live-status",
  ".anthbot-menu-toggle",
  ".anthbot-glass-panel",
  "originalMountMap",
  "originalSync",
]) {
  if (!entry.includes(token)) {
    throw new Error(`Missing embedded-map chrome suppression token: ${token}`);
  }
}

for (const token of [
  "rotationForViewport",
  "mobile_map_rotation: 0",
  "mobileMapRotation: 0",
  "renderer.drawBackground = function",
  "backgroundGeometry.mapToScreen",
  'rename("rotation", "Background rotation")',
  'rename("mobile_map_rotation", "Mobile background rotation")',
]) {
  if (!entry.includes(token)) {
    throw new Error(`Background-only rotation regression: missing ${token}`);
  }
}

for (const token of [
  "static async getConfigElement()",
  "show_targets",
  "start_zone_mow",
  "start_auto_zone_mow",
]) {
  if (!core.includes(token)) {
    throw new Error(`Core regression: missing ${token}`);
  }
}

console.log("Embedded map chrome and background-only rotation checks passed.");
