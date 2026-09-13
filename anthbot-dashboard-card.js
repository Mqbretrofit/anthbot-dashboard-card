const CARD_VERSION = "0.3.0-dev.1";
const CARD_TAG = "anthbot-dashboard-card";
const EDITOR_TAG = "anthbot-dashboard-card-editor";
const MAP_TAG = "anthbot-map-card";

const ENTITY_MAP = {
  battery: ["sensor", ["battery_level"]],
  status: ["sensor", ["mower_status"]],
  rtk: ["sensor", ["rtk_fix_state", "rtk_state"]],
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

const MANUAL_ZONE_KEYS = ["custom_areas", "zones", "customAreas"];
const AUTO_ZONE_KEYS = [
  "region_areas", "regionAreas", "auto_regions", "autoRegions",
  "auto_zones", "autoZones", "regions",
];

const TARGETS = [
  ["full", "Full lawn", "▰"],
  ["zone", "Zones", "▦"],
  ["auto", "Auto zones", "◫"],
  ["edge", "Outer edge", "⌁"],
  ["dock-edge", "Dock area", "⌂"],
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

const asZoneList = (value) => Array.isArray(value)
  ? value.filter((item) => item && typeof item === "object")
  : [];

class AnthbotDashboardCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._config = {};
  }

  set hass(hass) {
    this._hass = hass;
    this._syncEntityPicker();
  }

  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  _render() {
    if (!this.shadowRoot) return;
    const config = this._config || {};
    const chips = Array.isArray(config.chips) && config.chips.length
      ? new Set(config.chips)
      : new Set(CHIP_DEFS.map(([key]) => key));
    const bool = (key, fallback = true) => config[key] === undefined ? fallback : config[key] !== false;
    this.shadowRoot.innerHTML = `
      <style>
        :host{display:block;color:var(--primary-text-color);font-family:var(--paper-font-body1_-_font-family,inherit)}
        .editor{display:grid;gap:16px}.section{display:grid;gap:12px;padding:14px;border:1px solid var(--divider-color,rgba(127,127,127,.25));border-radius:14px;background:var(--card-background-color,var(--ha-card-background,#fff))}.title{font-size:15px;font-weight:700}.hint{font-size:12px;line-height:1.4;color:var(--secondary-text-color)}
        label.field{display:grid;gap:6px;font-size:13px;font-weight:600}.field input,.field select{width:100%;min-height:42px;padding:8px 10px;border:1px solid var(--divider-color,rgba(127,127,127,.35));border-radius:8px;background:var(--card-background-color,var(--ha-card-background,#fff));color:var(--primary-text-color);font:inherit}.field input:focus,.field select:focus{outline:2px solid var(--primary-color);outline-offset:1px}
        ha-entity-picker{display:block;width:100%}.toggle{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:38px}.toggle-copy{display:grid;gap:2px}.toggle strong{font-size:13px}.switch{position:relative;width:42px;height:24px;flex:0 0 auto}.switch input{position:absolute;opacity:0;pointer-events:none}.slider{position:absolute;inset:0;border-radius:999px;background:var(--disabled-text-color,#9e9e9e);cursor:pointer;transition:.18s}.slider:after{content:"";position:absolute;width:18px;height:18px;left:3px;top:3px;border-radius:50%;background:white;box-shadow:0 1px 3px rgba(0,0,0,.35);transition:.18s}.switch input:checked+.slider{background:var(--primary-color)}.switch input:checked+.slider:after{transform:translateX(18px)}
        .chips-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.chip-option{display:flex;align-items:center;gap:8px;min-height:38px;padding:8px 10px;border:1px solid var(--divider-color,rgba(127,127,127,.25));border-radius:10px;font-size:13px;cursor:pointer}.chip-option input{accent-color:var(--primary-color)}
        .row{display:grid;grid-template-columns:1fr 1fr;gap:10px}@media(max-width:600px){.row,.chips-grid{grid-template-columns:1fr}}
      </style>
      <div class="editor">
        <div class="section">
          <div><div class="title">ANTHBOT mower</div><div class="hint">Select the ANTHBOT Map entity that belongs to this mower. Serial-scoped helpers and commands are resolved from this entity.</div></div>
          <label class="field"><span>Map entity</span><ha-entity-picker data-key="entity" allow-custom-entity></ha-entity-picker></label>
          <label class="field"><span>Dashboard title</span><input data-key="name" type="text" value="${this._escape(config.name ?? "ANTHBOT")}" placeholder="ANTHBOT"></label>
        </div>

        <div class="section">
          <div><div class="title">Hero appearance</div><div class="hint">Basic presentation settings for the dashboard and embedded ANTHBOT map.</div></div>
          <div class="row">
            <label class="field"><span>Dashboard height</span><input data-key="height" data-number="true" type="number" min="460" step="10" value="${this._escape(config.height ?? 650)}"></label>
            <label class="field"><span>Map fit</span><select data-key="fit"><option value="contain" ${config.fit === "contain" ? "selected" : ""}>Contain</option><option value="cover" ${config.fit !== "contain" ? "selected" : ""}>Cover</option></select></label>
          </div>
          <label class="field"><span>Background / aerial image</span><input data-key="image" type="text" value="${this._escape(config.image ?? "")}" placeholder="/local/garden.jpg"></label>
          <div class="row">
            <label class="field"><span>Map rotation</span><input data-key="rotation" data-number="true" type="number" step="1" value="${this._escape(config.rotation ?? 0)}"></label>
            <label class="field"><span>Mobile map rotation</span><input data-key="mobile_map_rotation" data-number="true" type="number" step="1" value="${this._escape(config.mobile_map_rotation ?? "")}"></label>
          </div>
        </div>

        <div class="section">
          <div><div class="title">Live information</div><div class="hint">Choose which live status chips are shown over the map.</div></div>
          ${this._toggleHtml("show_chips", "Show status chips", "Battery, status, RTK, progress and other live values.", bool("show_chips", true))}
          <div class="chips-grid" data-role="chip-options">
            ${CHIP_DEFS.map(([key, icon, label]) => `<label class="chip-option"><input type="checkbox" data-chip="${key}" ${chips.has(key) ? "checked" : ""}><span>${icon}</span><span>${label}</span></label>`).join("")}
          </div>
        </div>

        <div class="section">
          <div><div class="title">Mowing controls</div><div class="hint">The dashboard sends commands through the existing ANTHBOT Map services; model-specific routing stays in the integration.</div></div>
          ${this._toggleHtml("show_targets", "Show mowing target selector", "Full lawn, manual zones, auto zones, outer edge and dock area when available.", bool("show_targets", true))}
        </div>

        <div class="section">
          <div><div class="title">Map layers</div><div class="hint">Control the layers provided by the embedded ANTHBOT Map renderer.</div></div>
          ${this._toggleHtml("show_decoded_boundary", "Boundary", "Show the decoded lawn boundary.", bool("show_decoded_boundary", true))}
          ${this._toggleHtml("show_zones", "Zones", "Show mowing zones on the map.", bool("show_zones", true))}
          ${this._toggleHtml("show_no_go_zones", "No-go zones", "Show configured no-go areas.", bool("show_no_go_zones", true))}
          ${this._toggleHtml("show_no_go_labels", "No-go labels", "Show no-go zone labels.", bool("show_no_go_labels", true))}
        </div>
      </div>`;

    this._syncEntityPicker();
    this.shadowRoot.querySelectorAll("input[data-key], select[data-key]").forEach((element) => {
      element.addEventListener("change", () => this._fieldChanged(element));
    });
    this.shadowRoot.querySelectorAll("input[data-chip]").forEach((element) => {
      element.addEventListener("change", () => this._chipsChanged());
    });
  }

  _toggleHtml(key, title, hint, checked) {
    return `<div class="toggle"><div class="toggle-copy"><strong>${title}</strong><span class="hint">${hint}</span></div><label class="switch"><input type="checkbox" data-key="${key}" data-boolean="true" ${checked ? "checked" : ""}><span class="slider"></span></label></div>`;
  }

  _syncEntityPicker() {
    const picker = this.shadowRoot?.querySelector('ha-entity-picker[data-key="entity"]');
    if (!picker) return;
    picker.hass = this._hass;
    picker.value = this._config?.entity || "";
    picker.includeDomains = ["sensor"];
    if (!picker.__anthbotBound) {
      picker.__anthbotBound = true;
      picker.addEventListener("value-changed", (event) => {
        const value = event?.detail?.value;
        if (value !== undefined) this._setConfigValue("entity", value);
      });
    }
  }

  _fieldChanged(element) {
    const key = element.dataset.key;
    if (!key) return;
    if (element.dataset.boolean === "true") {
      this._setConfigValue(key, Boolean(element.checked));
      return;
    }
    if (element.dataset.number === "true") {
      const raw = String(element.value ?? "").trim();
      this._setConfigValue(key, raw === "" ? undefined : Number(raw));
      return;
    }
    this._setConfigValue(key, element.value);
  }

  _chipsChanged() {
    const chips = [...this.shadowRoot.querySelectorAll("input[data-chip]:checked")].map((element) => element.dataset.chip);
    this._setConfigValue("chips", chips);
  }

  _setConfigValue(key, value) {
    const next = { ...this._config };
    if (value === undefined || value === "") delete next[key]; else next[key] = value;
    this._config = next;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: next }, bubbles: true, composed: true }));
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
    this._toastTimer = null;
    this._lastStatus = "";
    this._rendered = false;
    this._targetPickerOpen = false;
    this._mowingTarget = { type: "full", ids: [] };
  }

  static async getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  static getStubConfig(hass) {
    const entity = Object.keys(hass?.states || {}).find((entityId) => (
      entityId.startsWith("sensor.") && entityId.endsWith("_map")
    ));
    return {
      entity: entity || "sensor.YOUR_MOWER_map",
      name: "ANTHBOT",
      height: 650,
      show_chips: true,
      show_targets: true,
    };
  }

  setConfig(config) {
    if (!config?.entity) {
      throw new Error("ANTHBOT Dashboard Card requires an ANTHBOT map entity");
    }
    this._config = {
      name: "ANTHBOT",
      height: 650,
      show_chips: true,
      show_targets: true,
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
    window.clearTimeout(this._toastTimer);
  }

  _renderShell() {
    const height = Math.max(460, Number(this._config?.height) || 650);
    this.shadowRoot.innerHTML = `
      <style>
        :host{display:block;--adb-radius:28px;--adb-glass:rgba(13,22,31,.68);--adb-border:rgba(255,255,255,.18);--adb-text:#f6f8fb;--adb-muted:rgba(235,241,247,.72);--adb-accent:var(--primary-color,#4caf50)}
        *{box-sizing:border-box}.dashboard{position:relative;min-height:${height}px;overflow:hidden;border-radius:var(--adb-radius);background:#111820;color:var(--adb-text);box-shadow:0 18px 46px rgba(0,0,0,.24);isolation:isolate}
        .map-host{position:absolute;inset:0;z-index:1}.map-host>${MAP_TAG}{display:block;width:100%;height:100%;min-height:${height}px}.vignette{position:absolute;inset:0;z-index:2;pointer-events:none;background:linear-gradient(180deg,rgba(5,12,18,.68) 0%,rgba(5,12,18,.08) 28%,rgba(5,12,18,.04) 53%,rgba(5,12,18,.82) 100%),linear-gradient(90deg,rgba(5,12,18,.18),transparent 35%,transparent 65%,rgba(5,12,18,.12))}
        .topbar{position:absolute;z-index:4;top:18px;left:18px;right:18px;display:flex;align-items:flex-start;justify-content:space-between;gap:16px;pointer-events:none}.identity{min-width:0;padding:12px 14px;border:1px solid var(--adb-border);border-radius:20px;background:var(--adb-glass);backdrop-filter:blur(16px) saturate(125%);box-shadow:0 10px 30px rgba(0,0,0,.24)}.name{max-width:min(58vw,420px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:clamp(19px,3vw,27px);font-weight:850;letter-spacing:-.025em}.subtitle{display:flex;align-items:center;gap:7px;min-height:18px;margin-top:3px;color:var(--adb-muted);font-size:12px;font-weight:700}.dot{width:8px;height:8px;border-radius:50%;background:#8794a0;box-shadow:0 0 0 4px rgba(135,148,160,.15)}.dot.online{background:#55e58a;box-shadow:0 0 0 4px rgba(85,229,138,.16)}.dot.busy{background:#ffd45c;box-shadow:0 0 0 4px rgba(255,212,92,.16)}
        .battery{flex:0 0 auto;display:grid;place-items:center;width:66px;height:66px;border-radius:50%;border:1px solid var(--adb-border);background:conic-gradient(var(--adb-accent) var(--battery-angle,0deg),rgba(255,255,255,.14) 0);box-shadow:0 10px 30px rgba(0,0,0,.25);position:relative}.battery:after{content:"";position:absolute;inset:5px;border-radius:50%;background:rgba(10,18,26,.86);backdrop-filter:blur(12px)}.battery-value{position:relative;z-index:1;font-size:15px;font-weight:900}
        .chips{position:absolute;z-index:4;top:106px;left:18px;right:18px;display:flex;gap:8px;overflow-x:auto;padding:2px 2px 8px;scrollbar-width:none;pointer-events:auto}.chips::-webkit-scrollbar,.controls::-webkit-scrollbar,.target-modes::-webkit-scrollbar,.zone-list::-webkit-scrollbar{display:none}.chip{flex:0 0 auto;display:flex;align-items:center;gap:7px;min-height:36px;padding:7px 11px;border:1px solid var(--adb-border);border-radius:999px;background:var(--adb-glass);color:var(--adb-text);backdrop-filter:blur(14px) saturate(120%);box-shadow:0 7px 22px rgba(0,0,0,.18);font-size:12px;font-weight:800;white-space:nowrap}.chip-icon{opacity:.82}
        .bottom{position:absolute;z-index:5;left:18px;right:18px;bottom:18px;display:grid;gap:10px;pointer-events:none}.progress-wrap{width:min(420px,100%);padding:10px 12px;border:1px solid var(--adb-border);border-radius:18px;background:rgba(10,18,26,.56);backdrop-filter:blur(14px);box-shadow:0 10px 28px rgba(0,0,0,.2)}.progress-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:7px;font-size:12px;font-weight:850}.progress-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.progress-value{flex:0 0 auto;color:#7eefaa}.track{height:6px;overflow:hidden;border-radius:999px;background:rgba(255,255,255,.14)}.fill{width:0;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--adb-accent),#79efab);transition:width .35s ease}
        .target-panel{pointer-events:auto;width:min(620px,100%);padding:10px;border:1px solid var(--adb-border);border-radius:22px;background:rgba(8,15,22,.82);backdrop-filter:blur(18px) saturate(130%);box-shadow:0 14px 36px rgba(0,0,0,.28)}.target-panel[hidden]{display:none!important}.target-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:2px 4px 8px;font-size:12px;font-weight:850;color:var(--adb-muted)}.target-modes{display:flex;gap:7px;overflow-x:auto;scrollbar-width:none}.target-mode,.zone-pill{min-height:38px;padding:0 12px;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(255,255,255,.07);color:#fff;font:inherit;font-size:12px;font-weight:800;cursor:pointer;white-space:nowrap}.target-mode.active,.zone-pill.active{border-color:rgba(85,229,138,.5);background:rgba(85,229,138,.18);color:#8af0af}.zone-list{display:flex;gap:7px;overflow-x:auto;margin-top:9px;padding-top:9px;border-top:1px solid rgba(255,255,255,.09);scrollbar-width:none}.zone-empty{padding:8px 4px;color:var(--adb-muted);font-size:12px}.zone-pill{display:flex;align-items:center;gap:7px}.zone-pill .check{width:16px;height:16px;display:grid;place-items:center;border-radius:5px;background:rgba(255,255,255,.1);font-size:10px}.zone-pill.active .check{background:#55e58a;color:#07120b}
        .controls{pointer-events:auto;display:flex;align-items:center;gap:8px;width:fit-content;max-width:100%;padding:8px;border:1px solid var(--adb-border);border-radius:24px;background:rgba(8,15,22,.76);backdrop-filter:blur(18px) saturate(130%);box-shadow:0 14px 36px rgba(0,0,0,.28);overflow-x:auto;scrollbar-width:none}button{appearance:none;border:0;outline:0;min-height:44px;padding:0 15px;border-radius:16px;background:rgba(255,255,255,.09);color:#fff;font:inherit;font-size:13px;font-weight:850;cursor:pointer;white-space:nowrap;transition:transform .12s ease,background .12s ease,opacity .12s ease}button:hover{background:rgba(255,255,255,.16)}button:active{transform:scale(.97)}button.primary{min-width:112px;background:var(--adb-accent);color:#07120b}.target-toggle{max-width:220px;overflow:hidden;text-overflow:ellipsis}.target-toggle.active{background:rgba(85,229,138,.18);color:#8af0af}.stop{background:rgba(255,92,92,.18);color:#ffaaaa}button[disabled]{opacity:.45;cursor:default;transform:none}
        .toast{position:absolute;z-index:8;left:50%;bottom:104px;transform:translate(-50%,16px);max-width:calc(100% - 36px);padding:9px 13px;border:1px solid var(--adb-border);border-radius:999px;background:rgba(8,15,22,.9);color:#fff;box-shadow:0 12px 34px rgba(0,0,0,.3);backdrop-filter:blur(16px);font-size:12px;font-weight:800;opacity:0;pointer-events:none;transition:opacity .18s ease,transform .18s ease}.toast.show{opacity:1;transform:translate(-50%,0)}.error{position:absolute;z-index:7;inset:0;display:none;place-items:center;padding:24px;background:#111820;text-align:center}.error.show{display:grid}.error-card{max-width:520px;padding:22px;border:1px solid rgba(255,255,255,.14);border-radius:22px;background:rgba(255,255,255,.06)}.error-card strong{display:block;margin-bottom:8px;font-size:18px}.error-card span{color:var(--adb-muted);font-size:13px;line-height:1.5}@media(max-width:600px){.dashboard{border-radius:22px}.topbar{top:12px;left:12px;right:12px}.chips{top:98px;left:12px;right:12px}.bottom{left:12px;right:12px;bottom:12px}.identity{padding:10px 12px}.battery{width:58px;height:58px}.controls{width:100%}button{flex:1 0 auto}.target-toggle{max-width:42vw}}
      </style>
      <ha-card class="dashboard">
        <div class="map-host" data-role="map-host"></div><div class="vignette"></div>
        <div class="topbar"><div class="identity"><div class="name" data-role="name">ANTHBOT</div><div class="subtitle"><span class="dot" data-role="connection-dot"></span><span data-role="status">Waiting for mower…</span></div></div><div class="battery" data-role="battery-ring"><span class="battery-value" data-role="battery">--%</span></div></div>
        <div class="chips" data-role="chips"></div>
        <div class="bottom">
          <div class="progress-wrap" data-role="progress-wrap"><div class="progress-head"><span class="progress-label" data-role="progress-label">Mowing progress</span><span class="progress-value" data-role="progress-value">--%</span></div><div class="track"><div class="fill" data-role="progress-fill"></div></div></div>
          <div class="target-panel" data-role="target-panel" hidden><div class="target-head"><span>Choose mowing target</span><span data-role="target-hint"></span></div><div class="target-modes" data-role="target-modes"></div><div class="zone-list" data-role="zone-list" hidden></div></div>
          <div class="controls"><button class="target-toggle" data-action="target">▰ Full lawn</button><button class="primary" data-action="primary">Start</button><button data-action="dock">Dock</button><button class="stop" data-action="stop">Stop</button></div>
        </div>
        <div class="toast" data-role="toast"></div><div class="error" data-role="error"><div class="error-card"><strong>ANTHBOT Map Card is required</strong><span>This dashboard reuses the proven ANTHBOT Map renderer. Install/configure ANTHBOT Map and make sure its frontend resource is loaded.</span></div></div>
      </ha-card>`;
    this.shadowRoot.querySelectorAll("button[data-action]").forEach((button) => button.addEventListener("click", () => this._handleAction(button.dataset.action)));
    this._rendered = true;
    this._mountMap();
  }

  async _mountMap() {
    const host = this.shadowRoot?.querySelector('[data-role="map-host"]');
    if (!host || !this._config) return;
    const tryMount = () => {
      if (!customElements.get(MAP_TAG)) return false;
      const mapCard = document.createElement(MAP_TAG);
      const config = { entity:this._config.entity,name:this._config.name||"ANTHBOT",map_only:true,menu_open:false,height:Math.max(460,Number(this._config.height)||650) };
      const passthrough = ["image","fit","rotation","mobile_map_rotation","mobile_map_fit","show_decoded_boundary","show_zones","show_no_go_zones","show_no_go_labels","calibration","robot_calibration","mowing_path_calibration","decoded_boundary_calibration","robot_heading_offset","robot_heading_source"];
      for (const key of passthrough) if (this._config[key] !== undefined) config[key] = this._config[key];
      mapCard.setConfig(config); if (this._hass) mapCard.hass = this._hass; host.replaceChildren(mapCard); this._mapCard = mapCard; this._setError(false); return true;
    };
    if (tryMount()) return;
    try { await Promise.race([customElements.whenDefined(MAP_TAG),new Promise((_,reject)=>window.setTimeout(()=>reject(new Error("timeout")),2500))]); if (!tryMount()) this._setError(true); } catch (_error) { this._setError(true); }
  }

  _setError(show) { this.shadowRoot?.querySelector('[data-role="error"]')?.classList.toggle("show",Boolean(show)); }

  _sync() {
    if (!this._hass || !this._config || !this.shadowRoot) return;
    if (this._mapCard) this._mapCard.hass = this._hass;
    const mapEntity = this._mapEntity(); this._serial = this._serialOf(mapEntity); this._resolved.clear();
    const name = this._config.name || mapEntity?.attributes?.friendly_name || "ANTHBOT"; this._text("name",String(name).replace(/\s+Map$/i,""));
    const statusObj = this._related("status"); const status = isUsable(statusObj) ? statusObj.state : mapEntity?.attributes?.mower_status || mapEntity?.attributes?.robot_status_raw || mapEntity?.state || "Unknown"; this._lastStatus = String(status ?? ""); this._text("status",this._prettyStatus(status));
    const batteryObj = this._related("battery"); const battery = this._number(batteryObj?.state ?? mapEntity?.attributes?.battery_level); this._text("battery",Number.isFinite(battery)?`${Math.round(battery)}%`:"--%"); const ring = this.shadowRoot.querySelector('[data-role="battery-ring"]'); if (ring) ring.style.setProperty("--battery-angle",`${Math.max(0,Math.min(100,battery||0))*3.6}deg`);
    const connectionObj = this._related("connection"); const connected = connectionObj ? ["on","connected","true","1"].includes(normalize(connectionObj.state)) : Boolean(mapEntity && normalize(mapEntity.state)!=="unavailable"); const dot = this.shadowRoot.querySelector('[data-role="connection-dot"]'); dot?.classList.toggle("online",connected&&!this._commandBusy); dot?.classList.toggle("busy",this._commandBusy);
    this._normalizeTargetSelection(); this._renderChips(); this._syncProgress(); this._renderTargetPicker(); this._syncControls();
  }

  _renderChips() {
    const container=this.shadowRoot?.querySelector('[data-role="chips"]'); if(!container)return; container.hidden=this._config.show_chips===false; if(container.hidden)return;
    const enabled=Array.isArray(this._config.chips)&&this._config.chips.length?new Set(this._config.chips):null; const parts=[];
    for(const [key,icon,label] of CHIP_DEFS){if(enabled&&!enabled.has(key))continue;const stateObj=this._related(key);if(!isUsable(stateObj))continue;parts.push(`<div class="chip" title="${label}"><span class="chip-icon">${icon}</span><span>${this._escape(this._displayValue(stateObj))}</span></div>`);} container.innerHTML=parts.join("");
  }

  _syncProgress() {
    const wrap=this.shadowRoot?.querySelector('[data-role="progress-wrap"]'); const progressObj=this._related("progress"); const progress=this._number(progressObj?.state); const active=this._isMowing(this._lastStatus)||this._isPaused(this._lastStatus)||Number.isFinite(progress); if(wrap)wrap.hidden=!active; if(!active)return;
    const percent=Math.max(0,Math.min(100,Number.isFinite(progress)?progress:0)); this._text("progress-value",Number.isFinite(progress)?`${Math.round(progress)}%`:"--%"); const fill=this.shadowRoot.querySelector('[data-role="progress-fill"]'); if(fill)fill.style.width=`${percent}%`; this._text("progress-label",this._isPaused(this._lastStatus)?"Paused":this._isMowing(this._lastStatus)?"Mowing":"Progress");
  }

  _renderTargetPicker() {
    const panel=this.shadowRoot?.querySelector('[data-role="target-panel"]'),modes=this.shadowRoot?.querySelector('[data-role="target-modes"]'),zoneList=this.shadowRoot?.querySelector('[data-role="zone-list"]'),hint=this.shadowRoot?.querySelector('[data-role="target-hint"]'); if(!panel||!modes||!zoneList)return;
    const activeTask=this._isMowing(this._lastStatus)||this._isPaused(this._lastStatus); panel.hidden=this._config.show_targets===false||!this._targetPickerOpen||activeTask; if(panel.hidden)return;
    const availability=this._targetAvailability(); modes.innerHTML=TARGETS.filter(([type])=>availability[type]).map(([type,label,icon])=>`<button class="target-mode ${this._mowingTarget.type===type?"active":""}" data-target-type="${type}">${icon} ${label}</button>`).join("");
    modes.querySelectorAll("button[data-target-type]").forEach((button)=>button.addEventListener("click",()=>{this._mowingTarget={type:button.dataset.targetType,ids:[]};this._renderTargetPicker();this._syncControls();}));
    const zoneMode=this._mowingTarget.type==="zone"||this._mowingTarget.type==="auto"; zoneList.hidden=!zoneMode; if(!zoneMode){zoneList.innerHTML="";if(hint)hint.textContent="";return;}
    const zones=this._mowingTarget.type==="zone"?this._manualZones():this._autoZones(); if(hint)hint.textContent=zones.length?`${this._mowingTarget.ids.length}/${zones.length} selected`:"No zones"; if(!zones.length){zoneList.innerHTML=`<div class="zone-empty">No ${this._mowingTarget.type==="zone"?"manual":"auto"} zones are available for this mower.</div>`;return;}
    const selected=new Set(this._mowingTarget.ids.map(String)); zoneList.innerHTML=zones.map((zone,index)=>{const id=this._zoneId(zone,index),active=selected.has(String(id));return `<button class="zone-pill ${active?"active":""}" data-zone-id="${this._escape(id)}"><span class="check">${active?"✓":""}</span>${this._escape(this._zoneName(zone,index))}</button>`;}).join("");
    zoneList.querySelectorAll("button[data-zone-id]").forEach((button)=>button.addEventListener("click",()=>{const id=button.dataset.zoneId,ids=new Set(this._mowingTarget.ids.map(String));if(ids.has(id))ids.delete(id);else ids.add(id);this._mowingTarget={...this._mowingTarget,ids:[...ids]};this._renderTargetPicker();this._syncControls();}));
  }

  _syncControls() {
    const primary=this.shadowRoot?.querySelector('button[data-action="primary"]'),target=this.shadowRoot?.querySelector('button[data-action="target"]'),dock=this.shadowRoot?.querySelector('button[data-action="dock"]'),stop=this.shadowRoot?.querySelector('button[data-action="stop"]'); if(!primary)return; const activeTask=this._isMowing(this._lastStatus),paused=this._isPaused(this._lastStatus);
    if(paused){primary.textContent="Resume";primary.dataset.command="resume_mow";primary.disabled=this._commandBusy;}else if(activeTask){primary.textContent="Pause";primary.dataset.command="pause_mow";primary.disabled=this._commandBusy;}else{const command=this._targetCommand();primary.textContent=command.valid?"Start":"Select zone";primary.dataset.command=command.service;primary.disabled=this._commandBusy||!command.valid;}
    if(target){target.hidden=this._config.show_targets===false;target.textContent=this._targetLabel();target.disabled=this._commandBusy||activeTask||paused;target.classList.toggle("active",this._targetPickerOpen&&!activeTask&&!paused);} if(dock)dock.disabled=false;if(stop)stop.disabled=false;
  }

  async _handleAction(action) {
    if(!this._hass||!this._config)return;
    if(action==="target"){if(this._commandBusy||this._isMowing(this._lastStatus)||this._isPaused(this._lastStatus))return;this._targetPickerOpen=!this._targetPickerOpen;this._renderTargetPicker();this._syncControls();return;}
    if(action==="primary"){if(this._commandBusy)return;if(this._isPaused(this._lastStatus))return this._callAnthbot("resume_mow",{},false);if(this._isMowing(this._lastStatus))return this._callAnthbot("pause_mow",{},false);const command=this._targetCommand();if(!command.valid){this._targetPickerOpen=true;this._renderTargetPicker();this._syncControls();this._toast("Select at least one zone");return;}this._targetPickerOpen=false;this._renderTargetPicker();return this._callAnthbot(command.service,command.data,false);}
    if(action==="dock")return this._callAnthbot("return_to_dock",{},true); if(action==="stop")return this._callAnthbot("stop_mow",{},true);
  }

  _targetCommand() {
    const ids=this._mowingTarget.ids||[];
    switch(this._mowingTarget.type){case"zone":return{service:"start_zone_mow",data:{zones:ids},valid:ids.length>0};case"auto":return{service:"start_auto_zone_mow",data:{auto_zones:ids},valid:ids.length>0};case"edge":return{service:"start_outer_edge_mow",data:{},valid:true};case"dock-edge":return{service:"start_dock_edge_mow",data:{},valid:true};default:return{service:"start_full_mow",data:{},valid:true};}
  }

  _targetAvailability(){return{full:true,zone:this._manualZones().length>0,auto:this._autoZones().length>0,edge:true,"dock-edge":true};}
  _targetLabel(){const def=TARGETS.find(([type])=>type===this._mowingTarget.type)||TARGETS[0],count=this._mowingTarget.ids?.length||0,suffix=(this._mowingTarget.type==="zone"||this._mowingTarget.type==="auto")&&count?` · ${count}`:"";return`${def[2]} ${def[1]}${suffix}`;}
  _normalizeTargetSelection(){const availability=this._targetAvailability();if(!availability[this._mowingTarget.type])this._mowingTarget={type:"full",ids:[]};if(this._mowingTarget.type!=="zone"&&this._mowingTarget.type!=="auto")return;const zones=this._mowingTarget.type==="zone"?this._manualZones():this._autoZones(),allowed=new Set(zones.map((zone,index)=>String(this._zoneId(zone,index))));this._mowingTarget.ids=(this._mowingTarget.ids||[]).filter((id)=>allowed.has(String(id)));}
  _manualZones(){const area=this._areaDefinition();for(const key of MANUAL_ZONE_KEYS){const zones=asZoneList(area?.[key]);if(zones.length)return zones;}return asZoneList(this._mapEntity()?.attributes?.custom_areas);}
  _autoZones(){const area=this._areaDefinition();for(const key of AUTO_ZONE_KEYS){const zones=asZoneList(area?.[key]);if(zones.length)return zones;}return asZoneList(this._mapEntity()?.attributes?.region_areas);}
  _areaDefinition(){const value=this._mapEntity()?.attributes?.area_definition;return value&&typeof value==="object"&&!Array.isArray(value)?value:{};}
  _zoneId(zone,index){const id=zone?.id??zone?.zone_id??zone?.area_id;return id!==undefined&&id!==null&&String(id).trim()!==""?String(id):String(index+1);}
  _zoneName(zone,index){return String(zone?.name??zone?.zone_name??zone?.title??`Zone ${this._zoneId(zone,index)}`);}

  async _callAnthbot(service,extraData={},safetyAction=false){if(!safetyAction){this._commandBusy=true;this._syncControls();this._syncConnectionDotBusy();}const data={entity_id:this._config.entity,...extraData};if(this._serial)data.serial_number=this._serial;try{this._toast(`${this._serviceLabel(service)}…`);await this._hass.callService("anthbot_map",service,data);this._toast(`${this._serviceLabel(service)} sent`);}catch(error){console.error("[ANTHBOT Dashboard] command failed",service,error);this._toast(`Command failed: ${this._serviceLabel(service)}`);}finally{if(!safetyAction){window.clearTimeout(this._commandTimer);this._commandTimer=window.setTimeout(()=>{this._commandBusy=false;this._sync();},1600);}}}
  _syncConnectionDotBusy(){const dot=this.shadowRoot?.querySelector('[data-role="connection-dot"]');dot?.classList.toggle("busy",this._commandBusy);if(this._commandBusy)dot?.classList.remove("online");}
  _toast(message){const toast=this.shadowRoot?.querySelector('[data-role="toast"]');if(!toast)return;toast.textContent=message;toast.classList.add("show");window.clearTimeout(this._toastTimer);this._toastTimer=window.setTimeout(()=>toast.classList.remove("show"),2200);}
  _serviceLabel(service){return({start_full_mow:"Starting full lawn",start_zone_mow:"Starting selected zones",start_auto_zone_mow:"Starting auto zones",start_outer_edge_mow:"Starting outer edge",start_dock_edge_mow:"Starting dock area",pause_mow:"Pausing",resume_mow:"Resuming",return_to_dock:"Returning to dock",stop_mow:"Stopping"})[service]||service;}

  _related(key){if(this._resolved.has(key))return this._resolved.get(key);const definition=ENTITY_MAP[key];if(!definition)return null;const[domain,suffixes]=definition,configured=this._config?.entities?.[key];if(configured&&this._hass.states?.[configured]){const stateObj=this._hass.states[configured];if(!this._serial||!this._serialOf(stateObj)||this._serialOf(stateObj)===this._serial){this._resolved.set(key,stateObj);return stateObj;}}const candidates=Object.entries(this._hass.states||{}).filter(([entityId,stateObj])=>entityId.startsWith(`${domain}.`)&&isUsable(stateObj)).filter(([entityId,stateObj])=>{const serial=this._serialOf(stateObj);if(this._serial)return serial===this._serial;const base=this._mapBase();return base&&entityId.startsWith(`${domain}.${base}_`);}).map(([entityId,stateObj])=>{const objectId=normalize(entityId.split(".",2)[1]),friendly=normalize(stateObj.attributes?.friendly_name);let score=-1;for(const suffix of suffixes){const semantic=normalize(suffix);if(objectId.endsWith(`_${semantic}`)||objectId===semantic)score=Math.max(score,100);else if(friendly.endsWith(`_${semantic}`)||friendly===semantic)score=Math.max(score,80);else if(objectId.includes(semantic))score=Math.max(score,50);}return{entityId,stateObj,score};}).filter((item)=>item.score>=0).sort((a,b)=>b.score-a.score||a.entityId.localeCompare(b.entityId));const winner=candidates[0]?.stateObj||null;this._resolved.set(key,winner);return winner;}
  _mapEntity(){return this._hass?.states?.[this._config?.entity];}
  _serialOf(stateObj){const attrs=stateObj?.attributes||{};return String(attrs.serial_number??attrs.serial??"").trim();}
  _mapBase(){const entityId=String(this._config?.entity||"");if(!entityId.includes("."))return"";return entityId.split(".",2)[1].replace(/_map$/,"");}
  _displayValue(stateObj){if(!stateObj)return"—";const unit=stateObj.attributes?.unit_of_measurement;return unit?`${stateObj.state} ${unit}`:this._prettyStatus(stateObj.state);}
  _prettyStatus(value){const raw=String(value??"Unknown").trim();if(!raw)return"Unknown";return raw.replace(/[_-]+/g," ").replace(/\b\w/g,(letter)=>letter.toUpperCase());}
  _isPaused(status){const value=normalize(status);return value.includes("pause")||value==="paused";}
  _isMowing(status){const value=normalize(status);if(!value||this._isPaused(value))return false;return["mow","cut","work","region","border","edge","zone"].some((part)=>value.includes(part));}
  _number(value){const num=Number.parseFloat(value);return Number.isFinite(num)?num:Number.NaN;}
  _text(role,value){const element=this.shadowRoot?.querySelector(`[data-role="${role}"]`);if(element&&element.textContent!==value)element.textContent=value;}
  _escape(value){return String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}
}

if(!customElements.get(EDITOR_TAG))customElements.define(EDITOR_TAG,AnthbotDashboardCardEditor);
if(!customElements.get(CARD_TAG))customElements.define(CARD_TAG,AnthbotDashboardCard);
window.customCards=window.customCards||[];
if(!window.customCards.some((card)=>card.type===CARD_TAG))window.customCards.push({type:CARD_TAG,name:"ANTHBOT Dashboard Card",description:"Hero-style dashboard for the ANTHBOT Map Home Assistant integration.",preview:true,documentationURL:"https://github.com/Mqbretrofit/anthbot-dashboard-card"});
console.info(`%c ANTHBOT Dashboard Card %c ${CARD_VERSION} `,"background:#55e58a;color:#07120b;font-weight:800;padding:2px 6px;border-radius:4px 0 0 4px","background:#18232d;color:#fff;padding:2px 6px;border-radius:0 4px 4px 0");
