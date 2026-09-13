const CARD_VERSION = "0.1.0-dev.1";
const CARD_TAG = "anthbot-dashboard-card";
const MAP_TAG = "anthbot-map-card";

const ENTITY_MAP = {
  battery: ["sensor", ["battery_level"]],
  status: ["sensor", ["mower_status"]],
  rtk: ["sensor", ["rtk_fix_state"]],
  progress: ["sensor", ["mowing_progress", "mowing_progress_test"]],
  height: ["sensor", ["cutting_height"]],
  area: ["sensor", ["mowing_area_session", "mowing_area"]],
  time: ["sensor", ["mowing_time_session", "mowing_time"]],
  connection: ["binary_sensor", ["connection"]],
};

const CHIP_DEFS = [
  ["battery", "🔋", "Battery"],
  ["status", "●", "Status"],
  ["rtk", "⌖", "RTK"],
  ["progress", "◔", "Progress"],
  ["height", "↕", "Height"],
  ["area", "▱", "Area"],
  ["time", "◷", "Time"],
];

const normalize = (value) => String(value ?? "")
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "");

const isUsable = (stateObj) => {
  if (!stateObj) return false;
  const value = normalize(stateObj.state);
  return value !== "unavailable" && value !== "unknown" && value !== "none";
};

class AnthbotDashboardCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = null;
    this._hass = null;
    this._mapCard = null;
    this._serial = "";
    this._resolved = new Map();
    this._commandBusy = false;
    this._commandTimer = null;
    this._lastStatus = "";
    this._rendered = false;
  }

  static getStubConfig(hass) {
    const entity = Object.keys(hass?.states || {}).find((entityId) => (
      entityId.startsWith("sensor.") && entityId.endsWith("_map")
    ));
    return {
      entity: entity || "sensor.YOUR_MOWER_map",
      name: "ANTHBOT",
      height: 620,
    };
  }

  setConfig(config) {
    if (!config?.entity) {
      throw new Error("ANTHBOT Dashboard Card requires an ANTHBOT map entity");
    }
    this._config = {
      name: "ANTHBOT",
      height: 620,
      show_chips: true,
      ...config,
    };
    this._resolved.clear();
    this._renderShell();
    if (this._hass) this._sync();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;
    if (!this._rendered) this._renderShell();
    this._sync();
  }

  getCardSize() {
    return 8;
  }

  disconnectedCallback() {
    window.clearTimeout(this._commandTimer);
  }

  _renderShell() {
    const height = Math.max(420, Number(this._config?.height) || 620);
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          --anthbot-dashboard-radius: 28px;
          --anthbot-dashboard-glass: rgba(13, 22, 31, .64);
          --anthbot-dashboard-border: rgba(255, 255, 255, .18);
          --anthbot-dashboard-text: #f6f8fb;
          --anthbot-dashboard-muted: rgba(235, 241, 247, .72);
          --anthbot-dashboard-accent: var(--primary-color, #4caf50);
        }
        * { box-sizing: border-box; }
        .dashboard {
          position: relative;
          min-height: ${height}px;
          overflow: hidden;
          border-radius: var(--anthbot-dashboard-radius);
          background: #111820;
          color: var(--anthbot-dashboard-text);
          box-shadow: 0 18px 46px rgba(0, 0, 0, .24);
          isolation: isolate;
        }
        .map-host {
          position: absolute;
          inset: 0;
          z-index: 1;
        }
        .map-host > ${MAP_TAG} {
          display: block;
          width: 100%;
          height: 100%;
          min-height: ${height}px;
        }
        .vignette {
          position: absolute;
          inset: 0;
          z-index: 2;
          pointer-events: none;
          background:
            linear-gradient(180deg, rgba(5, 12, 18, .66) 0%, rgba(5, 12, 18, .08) 28%, rgba(5, 12, 18, .04) 56%, rgba(5, 12, 18, .78) 100%),
            linear-gradient(90deg, rgba(5, 12, 18, .18), transparent 35%, transparent 65%, rgba(5, 12, 18, .12));
        }
        .topbar {
          position: absolute;
          z-index: 4;
          top: 18px;
          left: 18px;
          right: 18px;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          pointer-events: none;
        }
        .identity {
          min-width: 0;
          padding: 12px 14px;
          border: 1px solid var(--anthbot-dashboard-border);
          border-radius: 20px;
          background: var(--anthbot-dashboard-glass);
          backdrop-filter: blur(16px) saturate(125%);
          box-shadow: 0 10px 30px rgba(0, 0, 0, .24);
        }
        .name {
          max-width: min(58vw, 420px);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: clamp(19px, 3vw, 27px);
          font-weight: 850;
          letter-spacing: -.025em;
        }
        .subtitle {
          display: flex;
          align-items: center;
          gap: 7px;
          min-height: 18px;
          margin-top: 3px;
          color: var(--anthbot-dashboard-muted);
          font-size: 12px;
          font-weight: 700;
        }
        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #8794a0;
          box-shadow: 0 0 0 4px rgba(135, 148, 160, .15);
        }
        .dot.online { background: #55e58a; box-shadow: 0 0 0 4px rgba(85, 229, 138, .16); }
        .dot.busy { background: #ffd45c; box-shadow: 0 0 0 4px rgba(255, 212, 92, .16); }
        .battery {
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          width: 66px;
          height: 66px;
          border-radius: 50%;
          border: 1px solid var(--anthbot-dashboard-border);
          background: conic-gradient(var(--anthbot-dashboard-accent) var(--battery-angle, 0deg), rgba(255,255,255,.14) 0);
          box-shadow: 0 10px 30px rgba(0,0,0,.25);
          position: relative;
        }
        .battery::after {
          content: "";
          position: absolute;
          inset: 5px;
          border-radius: 50%;
          background: rgba(10, 18, 26, .86);
          backdrop-filter: blur(12px);
        }
        .battery-value {
          position: relative;
          z-index: 1;
          font-size: 15px;
          font-weight: 900;
        }
        .chips {
          position: absolute;
          z-index: 4;
          top: 106px;
          left: 18px;
          right: 18px;
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding: 2px 2px 8px;
          scrollbar-width: none;
          pointer-events: auto;
        }
        .chips::-webkit-scrollbar { display: none; }
        .chip {
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          gap: 7px;
          min-height: 36px;
          padding: 7px 11px;
          border: 1px solid var(--anthbot-dashboard-border);
          border-radius: 999px;
          background: var(--anthbot-dashboard-glass);
          color: var(--anthbot-dashboard-text);
          backdrop-filter: blur(14px) saturate(120%);
          box-shadow: 0 7px 22px rgba(0,0,0,.18);
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
        }
        .chip-icon { opacity: .82; }
        .bottom {
          position: absolute;
          z-index: 5;
          left: 18px;
          right: 18px;
          bottom: 18px;
          display: grid;
          gap: 10px;
          pointer-events: none;
        }
        .progress-wrap {
          width: min(420px, 100%);
          padding: 10px 12px;
          border: 1px solid var(--anthbot-dashboard-border);
          border-radius: 18px;
          background: rgba(10, 18, 26, .56);
          backdrop-filter: blur(14px);
          box-shadow: 0 10px 28px rgba(0,0,0,.2);
        }
        .progress-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 7px;
          font-size: 12px;
          font-weight: 850;
        }
        .progress-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .progress-value { flex: 0 0 auto; color: #7eefaa; }
        .track {
          height: 6px;
          overflow: hidden;
          border-radius: 999px;
          background: rgba(255,255,255,.14);
        }
        .fill {
          width: 0%;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, var(--anthbot-dashboard-accent), #79efab);
          transition: width .35s ease;
        }
        .controls {
          pointer-events: auto;
          display: flex;
          align-items: center;
          gap: 8px;
          width: fit-content;
          max-width: 100%;
          padding: 8px;
          border: 1px solid var(--anthbot-dashboard-border);
          border-radius: 24px;
          background: rgba(8, 15, 22, .72);
          backdrop-filter: blur(18px) saturate(130%);
          box-shadow: 0 14px 36px rgba(0,0,0,.28);
          overflow-x: auto;
          scrollbar-width: none;
        }
        .controls::-webkit-scrollbar { display: none; }
        button {
          appearance: none;
          border: 0;
          outline: 0;
          min-height: 44px;
          padding: 0 15px;
          border-radius: 16px;
          background: rgba(255,255,255,.09);
          color: #fff;
          font: inherit;
          font-size: 13px;
          font-weight: 850;
          cursor: pointer;
          white-space: nowrap;
          transition: transform .12s ease, background .12s ease, opacity .12s ease;
        }
        button:hover { background: rgba(255,255,255,.16); }
        button:active { transform: scale(.97); }
        button.primary {
          min-width: 112px;
          background: var(--anthbot-dashboard-accent);
          color: #07120b;
        }
        button.stop { background: rgba(255, 92, 92, .18); color: #ffaaaa; }
        button[disabled] { opacity: .48; cursor: default; transform: none; }
        .toast {
          position: absolute;
          z-index: 8;
          left: 50%;
          bottom: 104px;
          transform: translate(-50%, 16px);
          max-width: calc(100% - 36px);
          padding: 9px 13px;
          border: 1px solid var(--anthbot-dashboard-border);
          border-radius: 999px;
          background: rgba(8, 15, 22, .88);
          color: #fff;
          box-shadow: 0 12px 34px rgba(0,0,0,.3);
          backdrop-filter: blur(16px);
          font-size: 12px;
          font-weight: 800;
          opacity: 0;
          pointer-events: none;
          transition: opacity .18s ease, transform .18s ease;
        }
        .toast.show { opacity: 1; transform: translate(-50%, 0); }
        .error {
          position: absolute;
          z-index: 7;
          inset: 0;
          display: none;
          place-items: center;
          padding: 24px;
          background: #111820;
          text-align: center;
        }
        .error.show { display: grid; }
        .error-card {
          max-width: 520px;
          padding: 22px;
          border: 1px solid rgba(255,255,255,.14);
          border-radius: 22px;
          background: rgba(255,255,255,.06);
        }
        .error-card strong { display:block; margin-bottom:8px; font-size:18px; }
        .error-card span { color:var(--anthbot-dashboard-muted); font-size:13px; line-height:1.5; }
        @media (max-width: 600px) {
          .dashboard { border-radius: 22px; }
          .topbar { top: 12px; left: 12px; right: 12px; }
          .chips { top: 98px; left: 12px; right: 12px; }
          .bottom { left: 12px; right: 12px; bottom: 12px; }
          .identity { padding: 10px 12px; }
          .battery { width: 58px; height: 58px; }
          .controls { width: 100%; }
          button { flex: 1 0 auto; }
        }
      </style>
      <ha-card class="dashboard">
        <div class="map-host" data-role="map-host"></div>
        <div class="vignette"></div>
        <div class="topbar">
          <div class="identity">
            <div class="name" data-role="name">ANTHBOT</div>
            <div class="subtitle"><span class="dot" data-role="connection-dot"></span><span data-role="status">Waiting for mower…</span></div>
          </div>
          <div class="battery" data-role="battery-ring"><span class="battery-value" data-role="battery">--%</span></div>
        </div>
        <div class="chips" data-role="chips"></div>
        <div class="bottom">
          <div class="progress-wrap" data-role="progress-wrap">
            <div class="progress-head"><span class="progress-label" data-role="progress-label">Mowing progress</span><span class="progress-value" data-role="progress-value">--%</span></div>
            <div class="track"><div class="fill" data-role="progress-fill"></div></div>
          </div>
          <div class="controls">
            <button class="primary" data-action="primary">Start</button>
            <button data-action="dock">Dock</button>
            <button class="stop" data-action="stop">Stop</button>
          </div>
        </div>
        <div class="toast" data-role="toast"></div>
        <div class="error" data-role="error"><div class="error-card"><strong>ANTHBOT Map Card is required</strong><span>This dashboard reuses the proven ANTHBOT Map renderer. Install/configure ANTHBOT Map and make sure its frontend resource is loaded.</span></div></div>
      </ha-card>
    `;

    this.shadowRoot.querySelectorAll("button[data-action]").forEach((button) => {
      button.addEventListener("click", () => this._handleAction(button.dataset.action));
    });

    this._rendered = true;
    this._mountMap();
  }

  async _mountMap() {
    const host = this.shadowRoot?.querySelector('[data-role="map-host"]');
    if (!host || !this._config) return;

    const tryMount = () => {
      const ctor = customElements.get(MAP_TAG);
      if (!ctor) return false;
      const mapCard = document.createElement(MAP_TAG);
      const config = {
        entity: this._config.entity,
        name: this._config.name || "ANTHBOT",
        map_only: true,
        menu_open: false,
        height: Math.max(420, Number(this._config.height) || 620),
      };
      const passthrough = [
        "image", "fit", "rotation", "mobile_map_rotation", "mobile_map_fit",
        "show_decoded_boundary", "show_zones", "show_no_go_zones", "show_no_go_labels",
        "calibration", "robot_calibration", "mowing_path_calibration",
        "decoded_boundary_calibration", "robot_heading_offset", "robot_heading_source",
      ];
      for (const key of passthrough) {
        if (this._config[key] !== undefined) config[key] = this._config[key];
      }
      mapCard.setConfig(config);
      if (this._hass) mapCard.hass = this._hass;
      host.replaceChildren(mapCard);
      this._mapCard = mapCard;
      this._setError(false);
      return true;
    };

    if (tryMount()) return;
    try {
      await Promise.race([
        customElements.whenDefined(MAP_TAG),
        new Promise((_, reject) => window.setTimeout(() => reject(new Error("timeout")), 2500)),
      ]);
      if (!tryMount()) this._setError(true);
    } catch (_error) {
      this._setError(true);
    }
  }

  _setError(show) {
    const element = this.shadowRoot?.querySelector('[data-role="error"]');
    element?.classList.toggle("show", Boolean(show));
  }

  _sync() {
    if (!this._hass || !this._config || !this.shadowRoot) return;
    if (this._mapCard) this._mapCard.hass = this._hass;

    const mapEntity = this._hass.states?.[this._config.entity];
    this._serial = this._serialOf(mapEntity);
    this._resolved.clear();

    const name = this._config.name
      || mapEntity?.attributes?.friendly_name
      || "ANTHBOT";
    this._text("name", String(name).replace(/\s+Map$/i, ""));

    const statusObj = this._related("status");
    const status = isUsable(statusObj)
      ? statusObj.state
      : mapEntity?.attributes?.mower_status || mapEntity?.attributes?.robot_status_raw || mapEntity?.state || "Unknown";
    this._lastStatus = String(status ?? "");
    this._text("status", this._prettyStatus(status));

    const batteryObj = this._related("battery");
    const battery = this._number(batteryObj?.state ?? mapEntity?.attributes?.battery_level);
    this._text("battery", Number.isFinite(battery) ? `${Math.round(battery)}%` : "--%");
    const ring = this.shadowRoot.querySelector('[data-role="battery-ring"]');
    if (ring) ring.style.setProperty("--battery-angle", `${Math.max(0, Math.min(100, battery || 0)) * 3.6}deg`);

    const connectionObj = this._related("connection");
    const connected = connectionObj
      ? ["on", "connected", "true", "1"].includes(normalize(connectionObj.state))
      : Boolean(mapEntity && normalize(mapEntity.state) !== "unavailable");
    const dot = this.shadowRoot.querySelector('[data-role="connection-dot"]');
    dot?.classList.toggle("online", connected && !this._commandBusy);
    dot?.classList.toggle("busy", this._commandBusy);

    this._renderChips();
    this._syncProgress();
    this._syncControls();
  }

  _renderChips() {
    const container = this.shadowRoot?.querySelector('[data-role="chips"]');
    if (!container) return;
    container.hidden = this._config.show_chips === false;
    if (container.hidden) return;

    const enabled = Array.isArray(this._config.chips) && this._config.chips.length
      ? new Set(this._config.chips)
      : null;
    const parts = [];
    for (const [key, icon, label] of CHIP_DEFS) {
      if (enabled && !enabled.has(key)) continue;
      const stateObj = this._related(key);
      if (!isUsable(stateObj)) continue;
      const value = this._displayValue(stateObj);
      parts.push(`<div class="chip" title="${label}"><span class="chip-icon">${icon}</span><span>${this._escape(value)}</span></div>`);
    }
    container.innerHTML = parts.join("");
  }

  _syncProgress() {
    const wrap = this.shadowRoot?.querySelector('[data-role="progress-wrap"]');
    const progressObj = this._related("progress");
    const progress = this._number(progressObj?.state);
    const active = this._isMowing(this._lastStatus) || this._isPaused(this._lastStatus) || Number.isFinite(progress);
    if (wrap) wrap.hidden = !active;
    if (!active) return;

    const percent = Math.max(0, Math.min(100, Number.isFinite(progress) ? progress : 0));
    this._text("progress-value", Number.isFinite(progress) ? `${Math.round(progress)}%` : "--%");
    const fill = this.shadowRoot.querySelector('[data-role="progress-fill"]');
    if (fill) fill.style.width = `${percent}%`;
    const statusLabel = this._isPaused(this._lastStatus) ? "Paused" : this._isMowing(this._lastStatus) ? "Mowing" : "Progress";
    this._text("progress-label", statusLabel);
  }

  _syncControls() {
    const primary = this.shadowRoot?.querySelector('button[data-action="primary"]');
    const dock = this.shadowRoot?.querySelector('button[data-action="dock"]');
    const stop = this.shadowRoot?.querySelector('button[data-action="stop"]');
    if (!primary) return;

    if (this._isPaused(this._lastStatus)) {
      primary.textContent = "Resume";
      primary.dataset.command = "resume_mow";
    } else if (this._isMowing(this._lastStatus)) {
      primary.textContent = "Pause";
      primary.dataset.command = "pause_mow";
    } else {
      primary.textContent = "Start";
      primary.dataset.command = "start_full_mow";
    }
    primary.disabled = this._commandBusy;
    // Dock and Stop stay available even while another command is pending.
    if (dock) dock.disabled = false;
    if (stop) stop.disabled = false;
  }

  async _handleAction(action) {
    if (!this._hass || !this._config) return;
    if (action === "primary") {
      const button = this.shadowRoot?.querySelector('button[data-action="primary"]');
      const service = button?.dataset.command || "start_full_mow";
      if (this._commandBusy) return;
      await this._callAnthbot(service, false);
      return;
    }
    if (action === "dock") {
      await this._callAnthbot("return_to_dock", true);
      return;
    }
    if (action === "stop") {
      await this._callAnthbot("stop_mow", true);
    }
  }

  async _callAnthbot(service, safetyAction = false) {
    if (!safetyAction) {
      this._commandBusy = true;
      this._syncControls();
      this._syncConnectionDotBusy();
    }
    const data = { entity_id: this._config.entity };
    if (this._serial) data.serial_number = this._serial;

    try {
      this._toast(`${this._serviceLabel(service)}…`);
      await this._hass.callService("anthbot_map", service, data);
      this._toast(`${this._serviceLabel(service)} sent`);
    } catch (error) {
      console.error("[ANTHBOT Dashboard] command failed", service, error);
      this._toast(`Command failed: ${this._serviceLabel(service)}`);
    } finally {
      if (!safetyAction) {
        window.clearTimeout(this._commandTimer);
        this._commandTimer = window.setTimeout(() => {
          this._commandBusy = false;
          this._sync();
        }, 1600);
      }
    }
  }

  _syncConnectionDotBusy() {
    const dot = this.shadowRoot?.querySelector('[data-role="connection-dot"]');
    dot?.classList.toggle("busy", this._commandBusy);
    if (this._commandBusy) dot?.classList.remove("online");
  }

  _toast(message) {
    const toast = this.shadowRoot?.querySelector('[data-role="toast"]');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(this._toastTimer);
    this._toastTimer = window.setTimeout(() => toast.classList.remove("show"), 2200);
  }

  _serviceLabel(service) {
    const labels = {
      start_full_mow: "Starting",
      pause_mow: "Pausing",
      resume_mow: "Resuming",
      return_to_dock: "Returning to dock",
      stop_mow: "Stopping",
    };
    return labels[service] || service;
  }

  _related(key) {
    if (this._resolved.has(key)) return this._resolved.get(key);
    const definition = ENTITY_MAP[key];
    if (!definition) return null;
    const [domain, suffixes] = definition;
    const configured = this._config?.entities?.[key];
    if (configured && this._hass.states?.[configured]) {
      const stateObj = this._hass.states[configured];
      if (!this._serial || !this._serialOf(stateObj) || this._serialOf(stateObj) === this._serial) {
        this._resolved.set(key, stateObj);
        return stateObj;
      }
    }

    const candidates = Object.entries(this._hass.states || {})
      .filter(([entityId, stateObj]) => entityId.startsWith(`${domain}.`) && isUsable(stateObj))
      .filter(([entityId, stateObj]) => {
        const serial = this._serialOf(stateObj);
        if (this._serial) return serial === this._serial;
        const base = this._mapBase();
        return base && entityId.startsWith(`${domain}.${base}_`);
      })
      .map(([entityId, stateObj]) => {
        const objectId = normalize(entityId.split(".", 2)[1]);
        const friendly = normalize(stateObj.attributes?.friendly_name);
        let score = -1;
        for (const suffix of suffixes) {
          const semantic = normalize(suffix);
          if (objectId.endsWith(`_${semantic}`) || objectId === semantic) score = Math.max(score, 100);
          else if (friendly.endsWith(`_${semantic}`) || friendly === semantic) score = Math.max(score, 80);
          else if (objectId.includes(semantic)) score = Math.max(score, 50);
        }
        return { entityId, stateObj, score };
      })
      .filter((item) => item.score >= 0)
      .sort((a, b) => b.score - a.score || a.entityId.localeCompare(b.entityId));

    const winner = candidates[0]?.stateObj || null;
    this._resolved.set(key, winner);
    return winner;
  }

  _serialOf(stateObj) {
    const attrs = stateObj?.attributes || {};
    return String(attrs.serial_number ?? attrs.serial ?? "").trim();
  }

  _mapBase() {
    const entityId = String(this._config?.entity || "");
    if (!entityId.includes(".")) return "";
    return entityId.split(".", 2)[1].replace(/_map$/, "");
  }

  _displayValue(stateObj) {
    if (!stateObj) return "—";
    const unit = stateObj.attributes?.unit_of_measurement;
    const raw = stateObj.state;
    if (unit) return `${raw} ${unit}`;
    return this._prettyStatus(raw);
  }

  _prettyStatus(value) {
    const raw = String(value ?? "Unknown").trim();
    if (!raw) return "Unknown";
    return raw
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  _isPaused(status) {
    const value = normalize(status);
    return value.includes("pause") || value === "paused";
  }

  _isMowing(status) {
    const value = normalize(status);
    if (!value || this._isPaused(value)) return false;
    return ["mow", "cut", "work", "region", "border", "edge", "zone"].some((part) => value.includes(part));
  }

  _number(value) {
    const num = Number.parseFloat(value);
    return Number.isFinite(num) ? num : Number.NaN;
  }

  _text(role, value) {
    const element = this.shadowRoot?.querySelector(`[data-role="${role}"]`);
    if (element && element.textContent !== value) element.textContent = value;
  }

  _escape(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
}

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, AnthbotDashboardCard);
}

window.customCards = window.customCards || [];
if (!window.customCards.some((card) => card.type === CARD_TAG)) {
  window.customCards.push({
    type: CARD_TAG,
    name: "ANTHBOT Dashboard Card",
    description: "Hero-style dashboard for the ANTHBOT Map Home Assistant integration.",
    preview: false,
    documentationURL: "https://github.com/Mqbretrofit/anthbot-dashboard-card",
  });
}

console.info(`%c ANTHBOT Dashboard Card %c ${CARD_VERSION} `, "background:#55e58a;color:#07120b;font-weight:800;padding:2px 6px;border-radius:4px 0 0 4px", "background:#18232d;color:#fff;padding:2px 6px;border-radius:0 4px 4px 0");
