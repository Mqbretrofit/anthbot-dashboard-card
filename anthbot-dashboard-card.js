import "./anthbot-dashboard-card-core.js";

const CARD_TAG = "anthbot-dashboard-card";
const CARD_VERSION = "0.3.0-dev.2";
const EMBED_STYLE_ID = "anthbot-dashboard-embedded-map-style";
const EMBED_STYLE = `
  .map-live-status,
  .anthbot-menu-toggle,
  .anthbot-glass-panel {
    display: none !important;
  }
`;

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

  const originalMountMap = cardClass.prototype._mountMap;
  if (typeof originalMountMap === "function") {
    cardClass.prototype._mountMap = async function (...args) {
      const result = await originalMountMap.apply(this, args);
      suppressEmbeddedMapChrome.call(this);
      return result;
    };
  }

  const originalSync = cardClass.prototype._sync;
  if (typeof originalSync === "function") {
    cardClass.prototype._sync = function (...args) {
      const result = originalSync.apply(this, args);
      suppressEmbeddedMapChrome.call(this);
      return result;
    };
  }

  cardClass.prototype.__anthbotDashboardChromePatched = true;
}

console.info(
  `%c ANTHBOT Dashboard Card %c ${CARD_VERSION} `,
  "background:#55e58a;color:#07120b;font-weight:800;padding:2px 6px;border-radius:4px 0 0 4px",
  "background:#18232d;color:#fff;padding:2px 6px;border-radius:0 4px 4px 0",
);
