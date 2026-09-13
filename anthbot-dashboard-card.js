import "./anthbot-dashboard-card-core.js";

const CARD_TAG = "anthbot-dashboard-card";
const EDITOR_TAG = "anthbot-dashboard-card-editor";
const CARD_VERSION = "0.3.0-dev.3";
const EMBED_STYLE_ID = "anthbot-dashboard-embedded-map-style";
const EMBED_STYLE = `
  .map-live-status,
  .anthbot-menu-toggle,
  .anthbot-glass-panel {
    display: none !important;
  }
`;

const rotationForViewport = (config = {}) => {
  const baseRotation = Number(config.rotation) || 0;
  const mobileValue = config.mobile_map_rotation ?? config.mobileMapRotation;
  const mobileViewport = typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(max-width: 720px)").matches;
  const mobileRotation = mobileViewport && mobileValue !== undefined && mobileValue !== ""
    ? Number(mobileValue) || 0
    : 0;
  return baseRotation + mobileRotation;
};

const rotatePointAround = (point, center, radians) => {
  const dx = Number(point.x) - Number(center.x);
  const dy = Number(point.y) - Number(center.y);
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return {
    x: Number(center.x) + dx * cosine - dy * sine,
    y: Number(center.y) + dx * sine + dy * cosine,
  };
};

const cardClass = customElements.get(CARD_TAG);

if (cardClass && !cardClass.prototype.__anthbotDashboardChromePatched) {
  const suppressEmbeddedMapChrome = function () {
    const root = this._mapCard?.shadowRoot;
    if (!root) return;

    let style = root.querySelector(`#${EMBED_STYLE_ID}`);
    if (!style) {
      style = document.createElement("style");
      style.id = EMBED_STYLE_ID;
      root.appendChild(style);
    }
    if (style.textContent !== EMBED_STYLE) style.textContent = EMBED_STYLE;
  };

  const patchBackgroundRotation = function () {
    const renderer = this._mapCard?.renderer;
    if (!renderer || typeof renderer.drawBackground !== "function") return;

    const nextRotation = rotationForViewport(this._config);
    const firstPatch = !renderer.__anthbotDashboardBackgroundPatched;
    const rotationChanged = renderer.__anthbotDashboardBackgroundRotation !== nextRotation;
    renderer.__anthbotDashboardBackgroundRotation = nextRotation;

    if (firstPatch) {
      const originalDrawBackground = renderer.drawBackground.bind(renderer);
      renderer.__anthbotDashboardOriginalDrawBackground = originalDrawBackground;
      renderer.drawBackground = function (ctx, geometry, width, height) {
        const degrees = Number(this.__anthbotDashboardBackgroundRotation) || 0;
        if (!degrees || !this.image || !geometry || typeof geometry.mapToScreen !== "function") {
          return originalDrawBackground(ctx, geometry, width, height);
        }

        const center = geometry.mapToScreen({ x: 0.5, y: 0.5 });
        const radians = degrees * Math.PI / 180;
        const backgroundGeometry = Object.create(geometry);
        backgroundGeometry.mapToScreen = (point) => rotatePointAround(
          geometry.mapToScreen(point),
          center,
          radians,
        );
        return originalDrawBackground(ctx, backgroundGeometry, width, height);
      };
      renderer.__anthbotDashboardBackgroundPatched = true;
    }

    if (firstPatch || rotationChanged) renderer.draw();
  };

  const originalMountMap = cardClass.prototype._mountMap;
  if (typeof originalMountMap === "function") {
    cardClass.prototype._mountMap = async function (...args) {
      const dashboardConfig = this._config;
      if (dashboardConfig) {
        // The embedded ANTHBOT Map renderer must keep its view at 0°. The
        // dashboard's rotation fields are background-image calibration only.
        this._config = {
          ...dashboardConfig,
          rotation: 0,
          mobile_map_rotation: 0,
          mobileMapRotation: 0,
        };
      }

      let result;
      try {
        result = await originalMountMap.apply(this, args);
      } finally {
        this._config = dashboardConfig;
      }

      suppressEmbeddedMapChrome.call(this);
      patchBackgroundRotation.call(this);
      return result;
    };
  }

  const originalSync = cardClass.prototype._sync;
  if (typeof originalSync === "function") {
    cardClass.prototype._sync = function (...args) {
      const result = originalSync.apply(this, args);
      suppressEmbeddedMapChrome.call(this);
      patchBackgroundRotation.call(this);
      return result;
    };
  }

  cardClass.prototype.__anthbotDashboardChromePatched = true;
}

const editorClass = customElements.get(EDITOR_TAG);
if (editorClass && !editorClass.prototype.__anthbotDashboardRotationLabelsPatched) {
  const relabelRotationFields = function () {
    const rename = (key, label) => {
      const input = this.shadowRoot?.querySelector(`[data-key="${key}"]`);
      const field = input?.closest?.("label.field");
      const title = field?.querySelector(":scope > span");
      if (title) title.textContent = label;
    };
    rename("rotation", "Background rotation");
    rename("mobile_map_rotation", "Mobile background rotation");
  };

  const originalRender = editorClass.prototype._render;
  if (typeof originalRender === "function") {
    editorClass.prototype._render = function (...args) {
      const result = originalRender.apply(this, args);
      relabelRotationFields.call(this);
      return result;
    };
  }
  editorClass.prototype.__anthbotDashboardRotationLabelsPatched = true;
}

console.info(
  `%c ANTHBOT Dashboard Card %c ${CARD_VERSION} `,
  "background:#55e58a;color:#07120b;font-weight:800;padding:2px 6px;border-radius:4px 0 0 4px",
  "background:#18232d;color:#fff;padding:2px 6px;border-radius:0 4px 4px 0",
);
