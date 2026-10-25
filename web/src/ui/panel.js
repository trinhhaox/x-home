// The control panel that lives in the menu bar popover: header, scenes, rooms,
// device tiles and the detail sheets for a light or an AC.
import * as THREE from 'three';
import { h, clamp, createSlider, createColorPad, openMenu } from './dom.js';
import { icon } from './icons.js';
import { lightColor } from '../three/lights.js';
import { MODE_COLORS } from '../three/ac.js';
import { AC_SWINGS } from '../store.js';
import { haptic, isPhone, post } from '../bridge.js';
import { t, getModeLabel, getFanLabel, getSwingLabel } from '../i18n.js';
const SWATCHES = ['#ff5a4f', '#ff9a3c', '#ffd84a', '#5fe08a', '#42d6e8', '#4f8dff', '#8b5cff', '#ff5fc4'];

const TEMP_GRADIENT = 'linear-gradient(90deg, #2f7df6 0%, #58b4f5 34%, #f3e2c0 62%, #f6a54a 82%, #f0762c 100%)';
const DIM_GRADIENT = 'linear-gradient(90deg, #4a4f5e 0%, #b9a98c 45%, #ffe2b0 100%)';
const KELVIN_GRADIENT = 'linear-gradient(90deg, #ff9438 0%, #ffbd7a 30%, #ffe2c2 62%, #dfe9ff 100%)';

const NAVY = new THREE.Color('#17274f');
const tmp = new THREE.Color();
const css = (c) => `#${c.getHexString()}`;

function lightStatus(cfg, s) {
  if (!s.on) return t('off');
  return cfg.capabilities.includes('brightness') ? `${Math.round(s.brightness * 100)}%` : t('on');
}

function acTemperatureColor(target, cfg) {
  const t = clamp((target - cfg.min) / (cfg.max - cfg.min), 0, 1);
  return tmp.set('#1c4fc0').lerp(new THREE.Color('#8a3d12'), t).clone();
}

export function createPanel(root, config, store, { onFocus, onMenu }) {
  const { state } = store;
  const ui = { room: 'all', sheet: null };
  let world = null;
  const roomName = new Map(config.rooms.map((r) => [r.id, r.name]));

  /* ---------- skeleton ---------- */

  const canvas = h('canvas', { tabindex: -1 });
  const tooltip = h('div.tooltip');
  const homeSub = h('div.home-sub');
  const power = h('button.round.power', { title: t('toggleEverything'), 'aria-label': 'Toggle everything', onclick: toggleEverything }, icon('power', 21, 2.2));
  const gear = h('button.round', { title: t('floorPlan'), 'aria-label': 'Floor plan menu', onclick: () => onMenu(gear) }, icon('settings', 17));
  const isIslandInitial = () => window.__HOUSE_BOOT__?.islandShown !== false;
  let currentIslandShown = isIslandInitial();
  const islandBtn = isPhone ? null : h('button.round.island-btn', {
    title: currentIslandShown ? t('islandOnTitle') : t('islandOffTitle'),
    'aria-label': 'Toggle Notch Island',
    onclick: () => post('toggleIsland'),
  }, icon('island', 18));
  if (islandBtn && currentIslandShown) islandBtn.classList.add('on');
  const quit = isPhone ? null : h('button.round.quit', { title: t('quitApp'), 'aria-label': 'Quit Xhome', onclick: () => post('quit') }, icon('close', 17, 2.2));
  // Shown while an AI assistant has a link to this home (AI Access on the Mac).
  const aiBadge = h('button.ai-badge', { hidden: true, title: 'An AI assistant has access — click to manage', 'aria-label': 'AI access',
    onclick: () => onMenu(aiBadge, 'agent') }, icon('sparkles', 13, 2.2), h('span', 'AI'));
  // Shown when a newer version is available on GitHub.
  const updateBadge = h('button.update-badge', {
    hidden: true,
    title: t('updateBadgeTitle'),
    'aria-label': 'Update available',
    onclick: () => post('downloadUpdate'),
  }, icon('download', 13, 2.2), h('span', t('updateAvailable')));

  const scenes = h('div.scenes');
  const rooms = h('div.rooms');
  const listTitle = h('span.title');
  const grid = h('div.grid');
  const panel = h('section.panel',
    scenes, rooms,
    h('div.list-head', listTitle,
      h('button.pill', { onclick: () => bulk(true) }, t('allOn')),
      h('button.pill', { onclick: () => bulk(false) }, t('allOff'))),
    h('div.devices', grid));
  const sheet = h('section.sheet.hidden');
  sheet.inert = true;
  const toastEl = h('div.panel-toast');

  const clip = h('div.card-clip',
    h('div.stage', canvas),
    h('div.tint'),
    h('header.top',
      h('div.home', h('div.home-badge', icon('home', 17)),
        h('div', h('div.home-name', config.name), homeSub)),
      updateBadge, aiBadge, islandBtn, gear, power, quit),
    tooltip, panel, sheet, toastEl);
  const card = h('div.card.booting', h('div.notch'), clip);
  root.replaceChildren(card);

  /* ---------- scenes ---------- */

  const sceneButtons = new Map();
  for (const s of config.scenes) {
    const b = h('button.scene', { onclick: () => { haptic('medium'); store.applyScene(s.id); } }, icon(s.icon, 19), s.name);
    sceneButtons.set(s.id, b);
    scenes.append(b);
  }
  if (!config.scenes.length) scenes.style.display = 'none';

  /* ---------- rooms ---------- */

  const roomButtons = new Map();
  for (const r of [{ id: 'all', name: t('all') }, ...config.rooms]) {
    const count = h('span.count.zero', '0');
    const b = h('button.room', { onclick: () => { haptic('tick'); selectRoom(r.id); } }, r.name, count);
    roomButtons.set(r.id, { b, count });
    rooms.append(b);
  }

  function selectRoom(id) {
    if (ui.room === id) id = 'all';
    ui.room = id;
    layoutTiles();
    update();
    roomButtons.get(id).b.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    onFocus(id === 'all' ? null : { kind: 'room', id });
  }

  function inScope(cfg) {
    return ui.room === 'all' || cfg.room === ui.room;
  }

  function bulk(on) {
    haptic('medium');
    if (ui.room === 'all') { store.setAllLights(on); return; }
    for (const l of config.lights) if (l.room === ui.room) store.setLight(l.id, { on });
  }

  function toggleEverything() {
    haptic('heavy');
    const anyOn = Object.values(state.lights).some((l) => l.on) || Object.values(state.acs).some((a) => a.on);
    if (anyOn) {
      store.setAllLights(false);
      for (const id of Object.keys(state.acs)) store.setAC(id, { on: false });
    } else {
      store.setAllLights(true);
    }
  }

  /* ---------- tiles ---------- */

  const tiles = new Map();

  function lightTile(cfg) {
    const dimmable = cfg.capabilities.includes('brightness');
    const hasSheet = cfg.capabilities.length > 0;
    const sub = h('div.tile-sub');
    // A phone has no room for the button: touching and holding the tile opens the sheet there.
    const more = hasSheet && !isPhone
      ? h('button.tile-more', { 'aria-label': `${cfg.name} settings`, onclick: (e) => { e.stopPropagation(); openSheet({ kind: 'light', id: cfg.id }); } }, icon('sliders', 15))
      : null;
    const el = h(`div.tile${dimmable ? '.dimmable' : ''}`, { role: 'button', tabindex: 0, 'aria-label': cfg.name },
      h('div.bubble', icon(cfg.capabilities.length ? cfg.type : 'plug', 19)),
      h('div.tile-text', h('div.tile-name', cfg.name), sub),
      more,
      h('div.tile-level'));

    // Tap toggles; dragging sideways dims (HomeKit-style).
    let gesture = null;
    el.addEventListener('pointerdown', (ev) => {
      if (ev.target.closest('.tile-more') || ev.button !== 0) return;
      el.setPointerCapture(ev.pointerId);
      const s = state.lights[cfg.id];
      gesture = { x: ev.clientX, y: ev.clientY, start: s.on ? s.brightness : 0, moved: false, step: null };
      el.classList.add('pressed');
      if (isPhone && hasSheet) {
        gesture.hold = setTimeout(() => {
          if (!gesture || gesture.moved) return;
          gesture = null;
          el.classList.remove('pressed');
          haptic('medium');
          openSheet({ kind: 'light', id: cfg.id });
        }, 420);
      }
    });
    el.addEventListener('pointermove', (ev) => {
      if (!gesture) return;
      const dx = ev.clientX - gesture.x;
      if (Math.hypot(dx, ev.clientY - gesture.y) > 8) clearTimeout(gesture.hold);
      // A mostly vertical move is the list being scrolled, not a dim.
      if (!gesture.moved && dimmable && Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(ev.clientY - gesture.y)) {
        gesture.moved = true;
        el.classList.add('dragging');
      }
      if (gesture.moved) {
        const b = clamp(gesture.start + dx / el.clientWidth, 0, 1);
        const step = Math.round(b * 20);
        if (step !== gesture.step) { if (gesture.step !== null) haptic('tick'); gesture.step = step; }
        store.setLight(cfg.id, b < 0.04 ? { on: false } : { on: true, brightness: b });
      }
    });
    const finish = (ev) => {
      if (!gesture) return;
      const tapped = !gesture.moved && ev.type === 'pointerup';
      clearTimeout(gesture.hold);
      gesture = null;
      el.classList.remove('pressed', 'dragging');
      if (tapped) toggleLight(cfg.id);
    };
    el.addEventListener('pointerup', finish);
    el.addEventListener('pointercancel', finish);
    el.addEventListener('keydown', (ev) => {
      if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); toggleLight(cfg.id); }
    });

    return {
      el, cfg, kind: 'light',
      update() {
        const s = state.lights[cfg.id];
        el.classList.toggle('on', s.on);
        el.style.setProperty('--c', css(lightColor(s, tmp)));
        el.style.setProperty('--level', s.on ? String(s.brightness) : '0');
        // On a phone the group heading above the tile already names the room.
        sub.textContent = ui.room === 'all' && !isPhone ? `${lightStatus(cfg, s)} · ${roomName.get(cfg.room)}` : lightStatus(cfg, s);
      },
    };
  }

  function acTile(cfg) {
    const sub = h('div.tile-sub');
    const value = h('div.value');
    const bubble = h('div.bubble');
    const step = (d) => (e) => {
      e.stopPropagation();
      haptic('tick');
      const s = state.acs[cfg.id];
      store.setAC(cfg.id, { on: true, target: s.target + d });
    };
    const el = h('div.tile.ac', { role: 'button', tabindex: 0, 'aria-label': cfg.name, onclick: () => openSheet({ kind: 'ac', id: cfg.id }) },
      bubble,
      h('div.tile-text', h('div.tile-name', cfg.name), sub),
      h('div.stepper',
        h('button', { 'aria-label': 'Cooler', onclick: step(-1) }, icon('minus', 15, 2.2)),
        value,
        h('button', { 'aria-label': 'Warmer', onclick: step(1) }, icon('plus', 15, 2.2))),
      h('button.mini-power', { 'aria-label': `${cfg.name} power`, onclick: (e) => { e.stopPropagation(); haptic('medium'); store.setAC(cfg.id, { on: !state.acs[cfg.id].on }); } }, icon('power', 16, 2.2)));
    el.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') openSheet({ kind: 'ac', id: cfg.id }); });
    let shownMode = null;
    return {
      el, cfg, kind: 'ac',
      update() {
        const s = state.acs[cfg.id];
        el.classList.toggle('on', s.on);
        el.style.setProperty('--c', MODE_COLORS[s.mode]);
        if (shownMode !== s.mode) { bubble.replaceChildren(icon(s.mode, 19)); shownMode = s.mode; }
        value.textContent = `${s.target}°`;
        sub.textContent = `${s.on ? getModeLabel(s.mode) : t('off')} · ${t('room')} ${s.roomTemp.toFixed(isPhone ? 0 : 1)}°`;
      },
    };
  }

  function sensorTile(cfg) {
    const sub = h('div.tile-sub');
    const value = h('div.sensor-value', '—');
    const el = h('div.tile.sensor', { role: 'button', tabindex: 0, 'aria-label': cfg.name, onclick: () => openSheet({ kind: 'sensor', id: cfg.id }) },
      h('div.bubble', icon('thermo', 19)),
      h('div.tile-text', h('div.tile-name', cfg.name), sub),
      value);
    el.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        openSheet({ kind: 'sensor', id: cfg.id });
      }
    });
    return {
      el, cfg, kind: 'sensor',
      update() {
        const s = state.sensors[cfg.id] || {};
        const ready = Number.isFinite(s.temperature);
        const online = s.online !== false;
        el.classList.toggle('on', ready && online);
        el.classList.toggle('offline', !online);
        el.style.setProperty('--c', '#5ec8ff');
        value.textContent = ready ? `${s.temperature.toFixed(isPhone ? 0 : 1)}°` : '—';
        const details = [];
        if (!online) details.push(t('offline'));
        else if (!ready) details.push(t('waitingForReading'));
        if (Number.isFinite(s.humidity)) details.push(`${Math.round(s.humidity)}% ${t('humidity').toLowerCase()}`);
        if (Number.isFinite(s.battery)) details.push(`${Math.round(s.battery)}% ${t('battery').toLowerCase()}`);
        if (ui.room === 'all' && !isPhone) details.push(roomName.get(cfg.room));
        sub.textContent = details.join(' · ');
      },
    };
  }

  for (const cfg of config.acs) tiles.set(cfg.id, acTile(cfg));
  for (const cfg of config.sensors) tiles.set(cfg.id, sensorTile(cfg));
  for (const cfg of config.lights) tiles.set(cfg.id, lightTile(cfg));

  function toggleLight(id) {
    haptic('light');
    world?.lights.get(id)?.bump();
    store.toggleLight(id);
  }

  function layoutTiles() {
    const nodes = [];
    let i = 0;
    const add = (t) => { t.el.style.setProperty('--i', i++); nodes.push(t.el); };
    for (const room of config.rooms) {
      if (ui.room !== 'all' && room.id !== ui.room) continue;
      const devices = [...tiles.values()].filter((t) => t.cfg.room === room.id);
      if (!devices.length) continue;
      if (ui.room === 'all') nodes.push(h('div.group-label', room.name));
      devices.filter((t) => t.kind === 'ac').forEach(add);
      devices.filter((t) => t.kind === 'sensor').forEach(add);
      devices.filter((t) => t.kind === 'light').forEach(add);
    }
    if (!nodes.length) nodes.push(h('div.group-label', t('noDevicesInRoom')));
    else if (isPhone && config.lights.some((l) => l.capabilities.length && inScope(l))) {
      nodes.push(h('div.grid-hint', t('touchHoldHint')));
    }
    grid.replaceChildren(...nodes);
    grid.parentElement.scrollTop = 0;
  }

  /* ---------- sheets ---------- */

  let sheetView = null;

  function openSheet(target) {
    ui.sheet = target;
    sheetView = target.kind === 'ac' ? acSheet(target.id) : target.kind === 'sensor' ? sensorSheet(target.id) : lightSheet(target.id);
    sheet.replaceChildren(...sheetView.nodes);
    panel.classList.add('hidden');
    sheet.classList.remove('hidden');
    panel.inert = true;
    sheet.inert = false;
    card.classList.add('detail');
    hideTooltip();
    onFocus(target.kind === 'ac' ? target : target.kind === 'sensor' ? { kind: 'room', id: store.sensorCfg?.get(target.id)?.room || target.id } : { kind: 'room', id: store.lightCfg.get(target.id).room });
    update();
  }

  function closeSheet() {
    if (!ui.sheet) return false;
    ui.sheet = null;
    sheetView = null;
    sheet.classList.add('hidden');
    panel.classList.remove('hidden');
    panel.inert = false;
    sheet.inert = true;
    card.classList.remove('detail');
    onFocus(ui.room === 'all' ? null : { kind: 'room', id: ui.room });
    update();
    return true;
  }

  function sheetHead(name, sub, powerBtn) {
    return h('div.sheet-head',
      h('button.round', { 'aria-label': 'Back', onclick: closeSheet }, icon('back', 19, 2.2)),
      h('div.sheet-title', h('div.sheet-name', name), sub),
      powerBtn);
  }

  function bigNumber(unit) {
    const num = h('span.num');
    const el = h('div.big', num, h('small', unit));
    let shown = null;
    return {
      el,
      set(value, off) {
        el.classList.toggle('off', off);
        if (value === shown) return;
        if (shown !== null) {
          num.classList.remove('tick-up', 'tick-down');
          void num.offsetWidth;
          num.classList.add(value > shown ? 'tick-up' : 'tick-down');
        }
        num.textContent = value;
        shown = value;
      },
    };
  }

  function acSheet(id) {
    const cfg = store.acCfg.get(id);
    const s = () => state.acs[id];
    const set = (patch) => store.setAC(id, patch);
    const sub = h('div.sheet-sub');
    const powerBtn = h('button.round.power', { 'aria-label': 'Power', onclick: () => { haptic('medium'); set({ on: !s().on }); } }, icon('power', 21, 2.2));
    const big = bigNumber('°C');
    const eco = h('button.toggle-chip', { onclick: () => { haptic('light'); set({ eco: !s().eco }); } }, icon('leaf', 17), t('ecoMode'), h('span.switch'));
    const slider = createSlider({
      min: cfg.min, max: cfg.max, value: s().target, gradient: TEMP_GRADIENT,
      labels: [`${cfg.min}°`, `${cfg.max}°`],
      onInput: (v) => set({ on: true, target: v }),
    });

    const features = () => store.acFeatures(id);
    const option = (key, label, labelFn, values, iconName) => {
      const value = h('div.option-value');
      let holder = h('span');
      const el = h('button.option', { onclick: () => {
        el.classList.add('open');
        openMenu(clip, el, values().map((v) => ({
          label: typeof labelFn === 'function' ? labelFn(v) : labelFn[v], selected: s()[key] === v, icon: s()[key] === v ? icon('check', 16, 2.4) : null,
          action: () => { haptic('light'); set(key === 'mode' ? { on: true, mode: v } : { [key]: v }); },
        })), { onClose: () => el.classList.remove('open') });
      } }, holder, h('span.corner', icon('down', 15, 2.2)), h('div.option-label', label), value);
      let shown = null;
      return {
        el,
        update() {
          value.textContent = typeof labelFn === 'function' ? labelFn(s()[key]) : labelFn[s()[key]];
          const ic = iconName || s().mode;
          if (shown !== ic) {
            const next = icon(ic, 24, 1.6);
            holder.replaceWith(next);
            holder = next;
            shown = ic;
          }
        },
      };
    };

    const mode = option('mode', t('mode'), getModeLabel, () => features().modes, null);
    const fan = option('fan', isPhone ? t('fan') : t('fanSpeed'), getFanLabel, () => features().fans, 'fan');
    const swing = option('swing', t('airflow'), getSwingLabel, () => AC_SWINGS, 'wind');
    const sleepValue = h('div.option-value');
    const sleep = h('button.option', { onclick: () => { haptic('light'); set({ sleep: !s().sleep }); } },
      icon('moon', 24, 1.6), h('span.corner.dot'), h('div.option-label', t('sleep')), sleepValue);
    const options = h('div.options', mode.el, fan.el, sleep, swing.el);

    return {
      nodes: [
        sheetHead(cfg.name, sub, powerBtn),
        h('div.readout', big.el, eco),
        h('div.slider-row',
          h('button.round', { 'aria-label': t('cooler'), onclick: () => { haptic('tick'); set({ on: true, target: s().target - 1 }); } }, icon('minus', 18, 2.2)),
          slider.el,
          h('button.round', { 'aria-label': t('warmer'), onclick: () => { haptic('tick'); set({ on: true, target: s().target + 1 }); } }, icon('plus', 18, 2.2))),
        options,
      ],
      update() {
        const a = s();
        // A real AC only shows the controls it has a function for.
        const f = features();
        const shown = [[mode.el, f.modes.length > 0], [fan.el, f.fans.length > 0], [sleep, f.sleep], [swing.el, f.swing]];
        for (const [el, on] of shown) el.hidden = !on;
        eco.hidden = !f.eco;
        options.style.gridTemplateColumns = `repeat(${shown.filter(([, on]) => on).length || 1}, 1fr)`;
        powerBtn.classList.toggle('on', a.on);
        sub.replaceChildren(icon('thermo', 14), `${t('room')} `, h('b', `${a.roomTemp.toFixed(1)}°C`),
          h('span.live', { style: { background: a.on ? MODE_COLORS[a.mode] : 'rgba(255,255,255,.25)', boxShadow: a.on ? `0 0 8px ${MODE_COLORS[a.mode]}` : 'none' } }));
        big.set(a.target, !a.on);
        slider.set(a.target);
        eco.classList.toggle('on', a.eco);
        mode.update(); fan.update(); swing.update();
        sleep.classList.toggle('active', a.sleep);
        sleepValue.textContent = a.sleep ? t('on') : t('off');
      },
    };
  }

  function lightSheet(id) {
    const cfg = store.lightCfg.get(id);
    const s = () => state.lights[id];
    const set = (patch) => store.setLight(id, patch);
    const caps = cfg.capabilities;
    const sub = h('div.sheet-sub');
    const powerBtn = h('button.round.power', { 'aria-label': 'Power', onclick: () => toggleLight(id) }, icon('power', 21, 2.2));
    const big = bigNumber('%');
    const nodes = [sheetHead(cfg.name, sub, powerBtn), h('div.readout', big.el)];
    const sliders = {};

    if (caps.includes('brightness')) {
      sliders.brightness = createSlider({
        min: 5, max: 100, value: Math.round(s().brightness * 100), gradient: DIM_GRADIENT, detent: 5,
        onInput: (v) => set({ on: true, brightness: v / 100 }),
      });
      nodes.push(h('div.slider-row',
        h('button.round', { 'aria-label': t('dimmer'), onclick: () => { haptic('tick'); set({ on: true, brightness: s().brightness - 0.1 }); } }, icon('dim', 18)),
        sliders.brightness.el,
        h('button.round', { 'aria-label': t('brighter'), onclick: () => { haptic('tick'); set({ on: true, brightness: s().brightness + 0.1 }); } }, icon('bright', 18))));
    }
    let kelvinLabel = null;
    if (caps.includes('temp')) {
      kelvinLabel = h('span');
      sliders.temp = createSlider({
        min: 2200, max: 6500, step: 100, value: s().temp, gradient: KELVIN_GRADIENT, compact: true, detent: 500,
        onInput: (v) => set({ on: true, temp: v }),
      });
      nodes.push(h('div.field-label', h('span', t('colourTemp')), kelvinLabel), h('div.slider-row', sliders.temp.el));
    }
    let swatches = [];
    let pad = null;
    let colorLabel = null;
    if (caps.includes('color')) {
      colorLabel = h('span');
      pad = createColorPad({ value: s().color, onInput: (c) => set({ on: true, color: c }) });
      swatches = SWATCHES.map((c) => h('button.swatch', { 'aria-label': `Colour ${c}`, vars: { '--sw': c }, onclick: () => { haptic('light'); set({ on: true, color: c }); } }));
      nodes.push(h('div.field-label', h('span', t('colour')), colorLabel), pad.el, h('div.swatches', swatches));
    } else {
      nodes.push(h('div.sheet-note', icon(cfg.type, 20),
        `${roomName.get(cfg.room)} · ${t('lightNote').replace('{action}', isPhone ? 'tap' : 'click')}`));
    }

    return {
      nodes,
      update() {
        const l = s();
        powerBtn.classList.toggle('on', l.on);
        sub.replaceChildren(roomName.get(cfg.room), ' · ', h('b', l.on ? t('on') : t('off')));
        big.set(caps.includes('brightness') ? Math.round(l.brightness * 100) : l.on ? 100 : 0, !l.on);
        sliders.brightness?.set(Math.round(l.brightness * 100));
        sliders.temp?.set(l.temp);
        if (kelvinLabel) kelvinLabel.textContent = l.color ? '—' : `${l.temp} K`;
        swatches.forEach((el, i) => el.classList.toggle('selected', l.color?.toLowerCase() === SWATCHES[i]));
        pad?.set(l.color);
        if (colorLabel) colorLabel.textContent = l.color ? l.color.toUpperCase() : t('white');
      },
    };
  }

  function sensorSheet(id) {
    const cfg = (config.sensors || []).find((s) => s.id === id);
    const s = () => state.sensors[id] || {};
    const sub = h('div.sheet-sub');
    const big = bigNumber('°C');

    const comfortBadge = h('div.comfort-badge', '—');

    const humVal = h('span.metric-num', '—');
    const humStatus = h('span.metric-sub', t('humidity'));
    const humBar = h('div.metric-bar-fill');
    const humCard = h('div.metric-card',
      h('div.metric-head', h('span.metric-icon', icon('droplet', 16)), h('span.metric-title', t('humidity'))),
      h('div.metric-val-row', humVal),
      h('div.metric-bar-track', humBar),
      humStatus);

    const batVal = h('span.metric-num', '—');
    const batStatus = h('span.metric-sub', t('battery'));
    const batCard = h('div.metric-card',
      h('div.metric-head', h('span.metric-icon', icon('battery', 16)), h('span.metric-title', t('powerAndBattery'))),
      h('div.metric-val-row', batVal),
      batStatus);

    const chartPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    chartPath.setAttribute('class', 'chart-line');
    const chartFill = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    chartFill.setAttribute('class', 'chart-area');
    const chartSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    chartSvg.setAttribute('viewBox', '0 0 280 60');
    chartSvg.setAttribute('class', 'sensor-chart-svg');
    chartSvg.append(chartFill, chartPath);

    const minLabel = h('span.chart-min', `${t('min')}: —`);
    const maxLabel = h('span.chart-max', `${t('max')}: —`);
    const chartSection = h('div.sensor-trend-card',
      h('div.trend-head', h('span', t('tempTrend24h')), h('div.trend-range', minLabel, maxLabel)),
      chartSvg);

    const relatedAC = config.acs.find((a) => a.room === cfg.room);
    let acSection = null;
    if (relatedAC) {
      const acSub = h('div.tile-sub');
      const acPowerBtn = h('button.round.mini-power', { 'aria-label': 'AC Power', onclick: (e) => {
        e.stopPropagation();
        haptic('medium');
        store.setAC(relatedAC.id, { on: !state.acs[relatedAC.id].on });
      }}, icon('power', 16));
      const acTileEl = h('div.tile.ac-link', { onclick: () => openSheet({ kind: 'ac', id: relatedAC.id }) },
        h('div.bubble', icon('ac', 19)),
        h('div.tile-text', h('div.tile-name', `${relatedAC.name}`), acSub),
        acPowerBtn);
      const quickCoolBtn = h('button.quick-climate-btn', {
        onclick: (e) => {
          e.stopPropagation();
          haptic('medium');
          store.setAC(relatedAC.id, { on: true, mode: 'cool', target: 24 });
        }
      }, icon('cool', 15), t('cool24'));

      const quickEcoBtn = h('button.quick-climate-btn', {
        onclick: (e) => {
          e.stopPropagation();
          haptic('medium');
          const cur = state.acs[relatedAC.id];
          if (!cur.on) {
            store.setAC(relatedAC.id, { on: true, mode: 'cool', target: 26, eco: true });
          } else {
            store.setAC(relatedAC.id, { target: 26, eco: true });
          }
        }
      }, icon('fan', 15), t('eco26'));

      const quickRow = h('div.ac-quick-row', quickCoolBtn, quickEcoBtn);

      acSection = h('div.related-ac-wrap', h('div.field-label', h('span', t('roomAirConditioner'))), acTileEl, quickRow);
    }

    const nodes = [
      sheetHead(cfg.name, sub, h('div.round.fake', icon('thermo', 19))),
      big.el,
      comfortBadge,
      h('div.metrics-row', humCard, batCard),
      chartSection,
    ];
    if (acSection) nodes.push(acSection);

    function updateChart() {
      const hist = store.sensorHistory ? store.sensorHistory(id) : [];
      const current = s().temperature;
      const points = [...hist.map((p) => p.temp)];
      if (Number.isFinite(current)) points.push(current);
      if (points.length < 2) {
        chartSvg.style.display = 'none';
        minLabel.textContent = Number.isFinite(current) ? `Current: ${current.toFixed(1)}°` : '';
        maxLabel.textContent = '';
        return;
      }
      chartSvg.style.display = 'block';
      const min = Math.min(...points);
      const max = Math.max(...points);
      minLabel.textContent = `Min ${min.toFixed(1)}°`;
      maxLabel.textContent = `Max ${max.toFixed(1)}°`;
      const range = Math.max(max - min, 0.8);
      const w = 280;
      const h_svg = 50;
      const step = w / (points.length - 1);
      const coords = points.map((p, idx) => {
        const x = idx * step;
        const y = h_svg - ((p - min) / range) * (h_svg - 14) - 7;
        return [x, y];
      });
      const d = coords.map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt[0].toFixed(1)} ${pt[1].toFixed(1)}`).join(' ');
      chartPath.setAttribute('d', d);
      chartFill.setAttribute('d', `${d} L ${w} ${h_svg + 15} L 0 ${h_svg + 15} Z`);
    }

    return {
      nodes,
      update() {
        const data = s();
        const ready = Number.isFinite(data.temperature);
        const online = data.online !== false;
        sub.replaceChildren(roomName.get(cfg.room), ' · ', h('b', online ? (ready ? 'Live Reading' : 'Waiting for reading') : 'Offline'));
        big.set(ready ? data.temperature.toFixed(1) : '—', !online || !ready);

        if (ready) {
          const t_val = data.temperature;
          if (t_val < 20) {
            comfortBadge.textContent = t('comfortCool');
            comfortBadge.className = 'comfort-badge cool';
          } else if (t_val <= 25.5) {
            comfortBadge.textContent = t('comfortIdeal');
            comfortBadge.className = 'comfort-badge ideal';
          } else if (t_val <= 28.5) {
            comfortBadge.textContent = t('comfortWarm');
            comfortBadge.className = 'comfort-badge warm';
          } else {
            comfortBadge.textContent = t('comfortHot');
            comfortBadge.className = 'comfort-badge hot';
          }
        } else {
          comfortBadge.textContent = t('noReading');
          comfortBadge.className = 'comfort-badge';
        }

        if (Number.isFinite(data.humidity)) {
          const h_val = Math.round(data.humidity);
          humVal.textContent = `${h_val}%`;
          humBar.style.width = `${Math.min(100, Math.max(0, h_val))}%`;
          humStatus.textContent = h_val < 35 ? t('dryAir') : h_val <= 65 ? t('comfortable') : t('highHumidity');
        } else {
          humVal.textContent = '—';
          humBar.style.width = '0%';
          humStatus.textContent = t('noSensorReported');
        }

        if (Number.isFinite(data.battery)) {
          const b_val = Math.round(data.battery);
          batVal.textContent = `${b_val}%`;
          batStatus.textContent = b_val < 20 ? t('lowBattery') : t('healthyCharge');
        } else {
          batVal.textContent = t('mainsPower');
          batStatus.textContent = t('continuousPower');
        }

        updateChart();

        if (relatedAC) {
          const a = state.acs[relatedAC.id];
          const acTileEl = acSection.querySelector('.tile.ac-link');
          acTileEl?.classList.toggle('on', a.on);
          const pBtn = acSection.querySelector('.mini-power');
          pBtn?.classList.toggle('on', a.on);
          const acSubEl = acSection.querySelector('.tile-sub');
          if (acSubEl) acSubEl.textContent = `${a.on ? getModeLabel(a.mode) : t('off')} · ${t('setTo')} ${a.target}°C`;
        }
      },
    };
  }

  /* ---------- tooltip ---------- */

  function hideTooltip() { tooltip.classList.remove('show'); }

  function showTooltip(hit) {
    if (!hit) { hideTooltip(); return; }
    let name;
    let status;
    let on;
    let color;
    if (hit.kind === 'light') {
      const cfg = store.lightCfg.get(hit.id);
      const s = state.lights[hit.id];
      name = cfg.name; status = lightStatus(cfg, s); on = s.on; color = css(lightColor(s, tmp));
    } else {
      const cfg = store.acCfg.get(hit.id);
      const s = state.acs[hit.id];
      name = cfg.name; status = s.on ? `${getModeLabel(s.mode)} ${s.target}°` : t('off'); on = s.on; color = MODE_COLORS[s.mode];
    }
    tooltip.replaceChildren(h('i.dot'), name, h('span', status));
    tooltip.classList.toggle('on', on);
    tooltip.style.setProperty('--dot', color);
    tooltip.style.left = `${clamp(hit.x, 70, card.clientWidth - 70)}px`;
    tooltip.style.top = `${Math.max(64, hit.y)}px`;
    tooltip.classList.add('show');
  }

  /* ---------- derived state ---------- */

  function mood() {
    if (ui.sheet?.kind === 'ac') {
      const a = state.acs[ui.sheet.id];
      if (!a.on) return NAVY.clone().multiplyScalar(0.8);
      if (a.mode === 'cool' || a.mode === 'heat' || a.mode === 'auto') return acTemperatureColor(a.target, store.acCfg.get(ui.sheet.id));
      return new THREE.Color(MODE_COLORS[a.mode]).multiplyScalar(0.38);
    }
    const sum = new THREE.Color(0, 0, 0);
    let weight = 0;
    for (const cfg of config.lights) {
      const s = state.lights[cfg.id];
      if (!s.on) continue;
      const w = cfg.capabilities.includes('brightness') ? s.brightness : 1;
      lightColor(s, tmp);
      sum.r += tmp.r * w; sum.g += tmp.g * w; sum.b += tmp.b * w;
      weight += w;
    }
    if (!weight) return NAVY.clone();
    sum.multiplyScalar(0.42 / weight);
    return NAVY.clone().lerp(sum, clamp(weight / 3.5, 0.25, 0.8));
  }

  function update() {
    const lights = Object.values(state.lights);
    const onCount = lights.filter((l) => l.on).length;
    const acsOn = Object.values(state.acs).filter((a) => a.on);
    const anyOn = onCount > 0 || acsOn.length > 0;

    homeSub.replaceChildren(
      h('span.live', { style: anyOn ? {} : { background: 'rgba(255,255,255,.25)', boxShadow: 'none' } }),
      h('b', onCount ? `${onCount} of ${lights.length}` : 'No'), ' lights on',
      acsOn.length ? ` · AC ${acsOn[0].target}°` : '');
    power.classList.toggle('on', anyOn);

    for (const [id, b] of sceneButtons) b.classList.toggle('active', state.scene === id);

    for (const [id, { b, count }] of roomButtons) {
      b.classList.toggle('active', ui.room === id);
      const n = config.lights.filter((l) => (id === 'all' || l.room === id) && state.lights[l.id].on).length;
      count.textContent = n;
      count.classList.toggle('zero', n === 0 || id === 'all');
    }

    const scoped = config.lights.filter(inScope);
    const scopedOn = scoped.filter((l) => state.lights[l.id].on).length;
    listTitle.replaceChildren(h('b', ui.room === 'all' ? 'Whole home' : roomName.get(ui.room)), ` · ${scopedOn} of ${scoped.length} on`);

    for (const t of tiles.values()) t.update();
    sheetView?.update();
    const m = css(mood());
    card.style.setProperty('--mood', m);
  }

  store.on(() => update());
  window.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && !closeSheet()) onMenu(null, 'escape');
  });

  layoutTiles();
  update();

  return {
    canvas,
    card,
    attach(w) { world = w; card.classList.remove('booting'); },
    showTooltip,
    openSheet,
    closeSheet,
    selectRoom,
    toggleLight,
    get room() { return ui.room; },
    setNotch(x) { card.style.setProperty('--notch-x', `${x}px`); },
    setAgentLive(live) { aiBadge.hidden = !live; },
    setIslandShown(shown) {
      currentIslandShown = !!shown;
      if (window.__HOUSE_BOOT__) window.__HOUSE_BOOT__.islandShown = currentIslandShown;
      if (islandBtn) {
        islandBtn.classList.toggle('on', currentIslandShown);
        islandBtn.classList.toggle('off', !currentIslandShown);
        islandBtn.title = currentIslandShown ? 'Notch Island is On — Click to turn off' : 'Notch Island is Off — Click to turn on';
      }
    },
    setUpdate(info) {
      if (info && info.available) {
        updateBadge.hidden = false;
        updateBadge.title = `Xhome v${info.version} is available — click to download`;
        const label = updateBadge.querySelector('span');
        if (label) label.textContent = `v${info.version}`;
      } else {
        updateBadge.hidden = true;
      }
    },
    /** `ai`: something an AI assistant did (who, what), instead of an error. */
    toast(text, ai = null) {
      toastEl.replaceChildren(...(ai ? [h('span.toast-ai', icon('sparkles', 13, 2.2), ai), h('span', text)] : [text]));
      toastEl.classList.toggle('ai', Boolean(ai));
      toastEl.classList.add('show');
      clearTimeout(toastEl.timer);
      toastEl.timer = setTimeout(() => toastEl.classList.remove('show'), 3200);
    },
    anchorMenu: clip,
  };
}
