import type { Astro, Game, Mission, Plan, Request, StormChoice } from './types';
import { COLORS, COST_CHARGE_SHIELD, COST_MAKE_AIR, FACTS, FOOD_FACTS, HQ, MAX_AIR, POWER_REGEN_AMOUNT, POWER_REGEN_EVERY, ROVER_SPEED, SAFE_ROUTE_FACTOR, SHIELD_PER_CHARGE } from './data';
import { activeRequests, astro, awaitingAid, dist, evaluate, fmt, healthOf, helperCandidates, mayDriveSelfHome, pointAlong, roverStuck, requestText, SICK_LIMIT, stars, stormCost } from './game';
import { HQ_PAD, mapScenery } from './scenery';
import { ICON, OPENMOJI_ASTRONAUT, OPENMOJI_ROCKET } from './icons';
import { statusText, type Weather } from './spaceweather';

export type Screen = 'title' | 'main' | 'planner' | 'event' | 'storm' | 'about' | 'end';

export interface UIState {
  screen: Screen;
  plan: Plan | null;
  paused: boolean;
  speed: number;
  muted: boolean;
  lastVersion: number;
  stormChoice: StormChoice | null;
  factIndex: number;
  weather: Weather;
  /** the Home / Restart menu is open */
  menu: boolean;
}

export const SPEEDS = [2, 6]; // game minutes per real second

const av = (a: Astro, cls = '') => `<div class="av ${cls}" style="--c:${a.color}"><img src="${OPENMOJI_ASTRONAUT}" alt="" /><i class="ini">${a.name[0]}</i></div>`;
/** Map marker: a teardrop pin whose tip sits on the astronaut's spot, with a ring that pulses while they are asking for help. */
const marker = (a: Astro, calling: boolean) => `<div class="marker ${calling ? 'calling' : ''} ${a.sick ? 'sick' : ''}" style="--c:${a.color}"><span class="mk-ring"></span><span class="mk-shape"></span><img src="${OPENMOJI_ASTRONAUT}" alt="" /><i class="ini">${a.name[0]}</i></div>`;
const KIND_ICON: Record<Request['kind'], keyof typeof ICON> = { air: 'air', stuck: 'rover', power: 'power', food: 'food', home: 'home' };
const lbl = (icon: keyof typeof ICON, text: string) => `<span class="lbl-i">${ICON[icon]}${text}</span>`;
const airHrs = (a: Astro) => `${Math.max(0, a.air / 60).toFixed(a.air >= 600 ? 0 : 1).replace('.0', '')} hrs`;
const airPct = (a: Astro) => Math.min(100, Math.round((a.air / MAX_AIR) * 100 * 1.6));
const airColor = (a: Astro) => (a.air < 480 ? 'coral' : a.air < 960 ? 'amber' : 'mint');
const clock = (g: Game) => `Day ${Math.floor(g.time / 1440) + 1} · Time on the moon: ${fmt(g.time % 1440)}`;
const healthText = (g: Game, a: Astro) => {
  if (!a.sick || a.sickSince === null) return `${healthOf(a)}%`;
  return `Sick! ${fmt(Math.max(0, SICK_LIMIT - (g.time - a.sickSince)))} left`;
};
const healthColor = (a: Astro) => (a.sick || healthOf(a) < 25 ? 'coral' : healthOf(a) < 50 ? 'amber' : 'mint');

function urgency(left: number): [string, string] {
  if (left < 90) return ['Hurry!', 'hurry'];
  if (left < 180) return ['Soon', 'soon'];
  return ['Later', 'later'];
}

const factHtml = (i: number, list = FACTS) => {
  const f = list[i % list.length];
  return `<div class="fact"><span class="fact-h">${list === FOOD_FACTS ? 'Food in space' : 'Real NASA science'}</span><span>${f.text}</span><span class="src">Source: ${f.source}${f.saved ? ` · ${f.saved}` : ''}</span></div>`;
};

// ---------- title / about ----------

export function renderTitle(ui: UIState): string {
  return `<div class="screen center title-screen">
  <img class="title-rocket" src="${OPENMOJI_ROCKET}" alt="" />
  <h1 class="title-h">Lunar Mission Control</h1>
  <div class="crew-row" aria-label="Bring 5 astronauts home">${['ines', 'jonas', 'mateo', 'priya', 'hana'].map((id) => `<div class="av lg" style="--c:${COLORS[id as keyof typeof COLORS]}"><img src="${OPENMOJI_ASTRONAUT}" alt="" /></div>`).join('')}<span class="arrow">${ICON.home}</span></div>
  <p class="lead">Bring all 5 astronauts home!</p>
  <div class="howto">
    <div class="card how"><div class="big-ic">${ICON.call}</div><b>Answer calls</b><div class="ic-row">${ICON.air}${ICON.power}${ICON.rover}</div></div>
    <div class="card how"><div class="big-ic">${ICON.power}</div><b>Spend wisely</b><div class="ic-row">${ICON.power}<span>→</span>${ICON.air}${ICON.shield}</div></div>
    <div class="card how"><div class="big-ic storm">${ICON.storm}</div><b>Beat sun storms</b><div class="ic-row">${ICON.storm}<span>→</span>${ICON.shield}</div></div>
  </div>
  <div style="display:flex;gap:16px;align-items:center"><button class="btn-big" data-action="start">Start!</button><button class="pill" data-action="about">About the NASA data</button></div>
  <span class="soft">Made by team Bring Nasi Lemak to The Moon</span>
  <span class="chip ${ui.weather.status === 'live' || ui.weather.status === 'mixed' ? 'way' : ''}" data-live="wxchip">${statusText(ui.weather)}</span></div>`;
}

export function renderAbout(ui: UIState): string {
  const li = (a: string, b: string) => `<li><b>${a}</b> ${b}</li>`;
  return `<div class="screen" style="padding:24px 40px;gap:14px">
  <div style="display:flex;align-items:center;gap:20px"><button class="pill" data-action="back-title">← Back</button><h1 style="color:#fff;font-size:34px">About the NASA data</h1></div>
  <div class="card pad" style="gap:10px">
    <h2>Where the sun storms come from</h2>
    <p style="font-size:18px">Each storm in the game is built from a <b>real solar flare</b>. A flare is a giant explosion on the Sun. NASA rates flares C, M or X, and each letter is 10 times stronger than the one before. The bigger the real flare, the longer and stronger the storm in your game.</p>
    <ul class="list">
      ${li('Live data:', 'NASA DONKI (Space Weather Database Of Notifications, Knowledge, Information) solar flares from the last 30 days. If the NASA server is busy or down, the game uses the live GOES X-ray flare list from NOAA (last 7 days) instead and says so. Both are asked every time you open the game.')}
      ${li('Archive data:', 'If the live call does not work (no internet, or NASA is busy), the game uses real flares and storms that NASA has documented, such as the Aug 1972 eruptions between Apollo 16 and 17. The game always says which one it is using. Archive data is never shown as live.')}
      ${li('Right now:', statusText(ui.weather) + '.')}
    </ul>
  </div>
  <div class="card pad" style="gap:10px">
    <h2>Real science in the game</h2>
    <ul class="list">
      ${li('Science cards:', 'short facts about radiation shelters, shielding and astronaut health. Each card names its NASA source.')}
      ${li('RadLab (a NASA radiation database):', 'one card shows a real reading from a radiation sensor on the space station. It is a saved copy, labelled as not live, because these NASA servers do not let a web page call them directly.')}
      ${li('NASA Open Science Data Repository (OSDR):', 'two cards come from real NASA studies of mice that flew on the space station, found with the OSDR search and saved with their study numbers.')}
      ${li('Canadian Space Agency (a NASA partner):', 'the food cards you see when an astronaut asks for nasi lemak.')}
    </ul>
  </div>
  <div class="card pad" style="gap:10px">
    <h2>Icons</h2>
    <ul class="list">
      ${li('Tabler Icons', '(MIT license, tabler.io/icons): the power, air, shield, drone, rover, sun and sick icons.')}
      ${li('OpenMoji', '(CC BY-SA 4.0, openmoji.org, by the OpenMoji contributors): the astronaut and rocket pictures.')}
    </ul>
  </div>
  <div class="card pad" style="gap:10px">
    <h2>What is made up</h2>
    <p style="font-size:18px">The astronauts, the map and the numbers for power, air and rover trips are simplified for play. They are not real engineering values. The idea is real though: shielding, power and air all compete, and every choice costs something.</p>
  </div></div>`;
}

// ---------- main ----------

// On a "bring home" rescue the target rides back with the helper once the rover reaches them.
function passenger(g: Game, m: Mission): Astro | null {
  if (m.vehicle !== 'rover' || m.path.length < 3) return null;
  const r = g.requests.find((q) => q.id === m.requestId);
  return r && r.kind === 'home' ? astro(g, r.astroId) : null;
}

function pickedUp(m: Mission): boolean {
  const leg1 = dist(m.path[0], m.path[1]);
  const total = leg1 + dist(m.path[1], m.path[2]);
  return total > 0 && m.elapsed / m.duration >= leg1 / total;
}

function menuHtml(): string {
  return `<div class="modal" role="dialog" aria-modal="true" aria-label="Menu">
    <div class="modal-card">
      <h2>Leave this game?</h2>
      <div class="modal-btns">
        <button class="btn-big" data-action="menu-close">Keep playing</button>
        <button class="pill" data-action="restart">${ICON.refresh} Restart</button>
        <button class="pill" data-action="home">${ICON.home} Home page</button>
      </div>
    </div>
  </div>`;
}

export function renderMain(g: Game, ui: UIState): string {
  const reqs = activeRequests(g).sort((a, b) => a.due - b.due);
  const calls = reqs.length ? reqs.map((r) => callCard(g, r)).join('') : `<div class="empty">No calls right now. Astronauts will call soon!</div>`;
  const movers = g.missions.map((m) => {
    const p = pointAlong(m.path, m.elapsed / m.duration);
    const h = m.helperId ? astro(g, m.helperId) : null;
    const pax = passenger(g, m);
    const rider = pax ? `<span data-rider="${m.id}" style="${pickedUp(m) ? '' : 'display:none'}">${av(pax)}</span>` : '';
    return `<div class="mover" data-mover="${m.id}" style="left:${p.x}%;top:${p.y}%">${h ? av(h) : `<div class="av" style="--c:#fff">${ICON.drone}</div>`}${rider}${m.vehicle === 'drone' ? '' : `<span class="veh">${ICON.rover}</span>`}</div>`;
  }).join('');
  const movingIds = new Set(g.missions.map((m) => m.helperId).filter(Boolean) as string[]);
  const hiddenRider = (a: Astro) => g.missions.some((m) => passenger(g, m)?.id === a.id && pickedUp(m));
  const calling = (a: Astro) => reqs.some((r) => r.astroId === a.id && r.missionId === null);
  const tagOf = (a: Astro) => `${a.name}${a.sick ? ` · ${ICON.sick} sick` : ''}`;
  // astronauts standing in the same place would overlap, so they share one pin with the markers side by side
  const groups: Astro[][] = [];
  for (const a of g.astros.filter((x) => !x.home && !movingIds.has(x.id))) {
    const grp = groups.find((gr) => dist(gr[0], a) < 7);
    if (grp) grp.push(a); else groups.push([a]);
  }
  const pins = groups.map((gr) => {
    if (gr.length === 1) {
      const a = gr[0];
      return `<div class="pin pin-a ${a.x > 72 ? 'flip' : ''}" data-pin="${a.id}" style="${hiddenRider(a) ? 'display:none;' : ''}left:${a.x}%;top:${a.y}%">${marker(a, calling(a))}<span class="tag">${tagOf(a)}</span></div>`;
    }
    const x = gr.reduce((t, a) => t + a.x, 0) / gr.length;
    const y = gr.reduce((t, a) => t + a.y, 0) / gr.length;
    const row = gr.map((a) => `<span class="mk-wrap" data-pin="${a.id}" style="${hiddenRider(a) ? 'display:none' : ''}">${marker(a, calling(a))}</span>`).join('');
    return `<div class="pin pin-g ${x > (gr.length > 2 ? 45 : 65) ? 'flip' : ''}" style="left:${x}%;top:${y}%"><div class="mk-row">${row}</div><span class="tag">${gr.map(tagOf).join(' + ')}</span></div>`;
  }).join('');
  const missions = g.missions.map((m) => {
    const r = g.requests.find((q) => q.id === m.requestId)!;
    const from = m.helperId ? av(astro(g, m.helperId), 'sm') : `<div class="av sm" style="--c:#fff">${ICON.drone}</div>`;
    return `<div class="mcard"><div class="t">${from}<span class="go">→</span>${av(astro(g, r.astroId), 'sm')}</div><div class="track"><div class="fill yellow" data-live="mprog-${m.id}" style="width:${Math.round((m.elapsed / m.duration) * 100)}%"></div></div></div>`;
  }).join('');
  const crew = g.astros.map((a) => `<div class="crewcard ${a.home ? 'home' : ''}">${av(a, 'sm')}<div class="info">
      <div class="top"><span class="nm">${a.name}</span><b data-live="air-${a.id}">${a.home ? 'Home!' : airHrs(a)}</b></div>
      <div class="track"><div class="fill ${a.home ? 'mint' : airColor(a)}" data-live="airbar-${a.id}" style="width:${a.home ? 100 : airPct(a)}%"></div></div>
      <div class="dose">${lbl('health', 'Health')}<div class="track thin"><div class="fill ${healthColor(a)}" data-live="dosebar-${a.id}" style="width:${healthOf(a)}%"></div></div><b data-live="dose-${a.id}">${a.home ? '-' : healthText(g, a)}</b></div>
    </div></div>`).join('');
  const open = reqs.filter((r) => r.missionId === null);
  const st = g.storm;
  const banner = st
    ? `<div class="storm-banner"><span>${ICON.storm} ${g.time < st.storm.startAt ? 'Sun storm arriving!' : 'Sun storm now!'} · ${st.storm.event.classType}</span><span data-live="storm-left">${g.time < st.storm.startAt ? `starts in ${fmt(st.storm.startAt - g.time)}` : `ends in ${fmt(st.endAt - g.time)}`} · ${st.choice === 'all' ? 'everyone sheltering' : st.choice === 'waiting' ? 'waiting crew sheltering' : 'no one sheltering'}</span></div>` : '';
  return `<div class="screen">
  <header class="hdr">
    <div><h1 class="hdr-title">Lunar Mission Control</h1><span class="soft" data-live="clock">${clock(g)}</span></div>
    <div class="hdr-right">
      <div class="speed">
        <button class="pill sm ${ui.paused ? 'on' : ''}" data-action="pause">${ui.paused ? 'Play' : 'Pause'}</button>
        <button class="pill sm ${!ui.paused && ui.speed === 0 ? 'on' : ''}" data-action="speed" data-v="0">Normal</button>
        <button class="pill sm ${!ui.paused && ui.speed === 1 ? 'on' : ''}" data-action="speed" data-v="1">Fast</button>
        <button class="pill sm" data-action="mute" aria-label="Toggle sound">${ui.muted ? 'Sound off' : 'Sound on'}</button>
        <button class="pill sm" data-action="menu" aria-label="Menu: home or restart">${ICON.home} Menu</button>
      </div>
      <div><span class="soft">Brought home: <b data-live="homecount">${g.astros.filter((a) => a.home).length} of 5</b></span><div class="slots">${g.astros.map((a) => `<div class="slot ${a.home ? 'full' : ''}"></div>`).join('')}</div></div>
    </div>
  </header>
  <div class="body">
    <aside class="col-l"><h2 class="sec">Help calls</h2><div class="calls">${calls}</div>${g.missions.length ? `<h2 class="sec">On the way</h2><div class="missions">${missions}</div>` : ''}</aside>
    <div class="map ${st && g.time >= st.storm.startAt ? 'storming' : ''}" role="img" aria-label="Moon map with astronauts">
      ${mapScenery(g)}
      <span class="title">Moon map</span>
      ${banner}
      <div class="pin pin-hq" style="left:${HQ.x}%;top:${HQ.y}%">${HQ_PAD}<span class="tag">Home base</span></div>
      ${pins}${movers}
    </div>
    <aside class="col-r"><h2 class="sec">My crew</h2>${crew}</aside>
  </div>
  <footer class="ftr">
    <div class="supplies">
      <div class="sup"><div class="r1">${lbl('power', 'Power')}<b data-live="sup-power">${Math.floor(g.power)}%</b></div><div class="track thin"><div class="fill yellow" data-live="powerbar" style="width:${g.power}%"></div></div><span class="mini">Sun adds +${POWER_REGEN_AMOUNT} every ${POWER_REGEN_EVERY} min</span></div>
      <div class="sup"><div class="r1">${lbl('air', 'Air tanks')}<b data-live="sup-tanks">${g.supplies.tanks}</b></div><button class="mk" data-action="makeair" data-live="btn-air" ${g.power >= COST_MAKE_AIR ? '' : 'disabled'}>Make 1 · −${COST_MAKE_AIR} power</button></div>
      <div class="sup"><div class="r1">${lbl('shield', 'Shield')}<b data-live="sup-shield">${Math.floor(g.shield)}%</b></div><button class="mk" data-action="charge" data-live="btn-shield" ${g.power >= COST_CHARGE_SHIELD && g.shield < 100 ? '' : 'disabled'}>Charge +${SHIELD_PER_CHARGE} · −${COST_CHARGE_SHIELD} power</button></div>
      <div class="sup small"><div class="r1">${lbl('drone', 'Drones')}<b data-live="sup-drones">${g.supplies.drones}</b></div></div>
    </div>
    <button class="btn-big" data-action="plan-urgent" ${open.length ? '' : 'disabled'}>${open.length ? 'Plan a rescue!' : 'Waiting for calls…'}</button>
  </footer>
  <div class="wx" data-live="wxchip">${statusText(ui.weather)}</div></div>${ui.menu ? menuHtml() : ''}`;
}

const CALL_LABEL: Record<Request['kind'], string> = { air: 'Need air!', power: 'Need power!', stuck: 'Stuck!', food: 'Nasi lemak!', home: 'Ride home!' };
const URGENT_FILL: Record<string, string> = { hurry: 'coral', soon: 'amber', later: 'mint' };
const leftPct = (left: number) => Math.max(0, Math.min(100, Math.round((left / 600) * 100)));
const needBadge = (r: Request) => `<span class="need">${ICON[KIND_ICON[r.kind]]}${r.kind === 'air' ? `<b>×${r.need}</b>` : ''}</span>`;

/** A help call as pictures: who, what they need, how long is left. */
function callCard(g: Game, r: Request): string {
  const a = astro(g, r.astroId);
  const left = r.due - g.time;
  const [, cls] = urgency(left);
  const on = r.missionId !== null;
  const hold = !on && a.busy;
  const when = on
    ? `<span class="chip way">${ICON.rover}→</span>`
    : hold ? `<span class="chip">${ICON.rover}…</span>`
    : `<span class="tm">${ICON.clock}<b data-live="left-${r.id}">${fmt(left)}</b></span><div class="track thin"><div class="fill ${URGENT_FILL[cls]}" data-live="leftbar-${r.id}" style="width:${leftPct(left)}%"></div></div>`;
  return `<button class="call ${on || hold ? '' : cls}" data-action="plan" data-req="${r.id}" ${on || hold ? 'disabled' : ''} aria-label="${requestText(g, r)}">${av(a, 'lg')}${needBadge(r)}<div class="when"><span class="cap">${CALL_LABEL[r.kind]}</span>${when}</div></button>`;
}

/** Cheap per-tick update that does not rebuild the DOM (so clicks are never lost). */
export function updateLive(root: HTMLElement, g: Game): void {
  const set = (k: string, f: (el: HTMLElement) => void) => { const el = root.querySelector<HTMLElement>(`[data-live="${k}"]`); if (el) f(el); };
  set('clock', (e) => (e.textContent = clock(g)));
  set('homecount', (e) => (e.textContent = `${g.astros.filter((a) => a.home).length} of 5`));
  for (const a of g.astros) {
    set(`air-${a.id}`, (e) => (e.textContent = a.home ? 'Home!' : airHrs(a)));
    set(`airbar-${a.id}`, (e) => { e.style.width = `${a.home ? 100 : airPct(a)}%`; e.className = `fill ${a.home ? 'mint' : airColor(a)}`; });
    set(`dose-${a.id}`, (e) => (e.textContent = a.home ? '-' : healthText(g, a)));
    set(`dosebar-${a.id}`, (e) => { e.style.width = `${healthOf(a)}%`; e.className = `fill ${healthColor(a)}`; });
  }
  for (const r of g.requests) if (!r.done && r.missionId === null) { set(`left-${r.id}`, (e) => (e.textContent = fmt(r.due - g.time))); set(`leftbar-${r.id}`, (e) => { e.style.width = `${leftPct(r.due - g.time)}%`; e.className = `fill ${URGENT_FILL[urgency(r.due - g.time)[1]]}`; }); }
  for (const m of g.missions) {
    const p = pointAlong(m.path, m.elapsed / m.duration);
    const mv = root.querySelector<HTMLElement>(`[data-mover="${m.id}"]`);
    if (mv) { mv.style.left = `${p.x}%`; mv.style.top = `${p.y}%`; }
    const pax = passenger(g, m);
    if (pax) {
      const on = pickedUp(m);
      const rd = root.querySelector<HTMLElement>(`[data-rider="${m.id}"]`);
      if (rd) rd.style.display = on ? '' : 'none';
      const pin = root.querySelector<HTMLElement>(`[data-pin="${pax.id}"]`);
      if (pin) pin.style.display = on ? 'none' : '';
    }
    set(`mprog-${m.id}`, (e) => (e.style.width = `${Math.min(100, Math.round((m.elapsed / m.duration) * 100))}%`));
  }
  const st = g.storm;
  if (st) set('storm-left', (e) => (e.textContent = `${g.time < st.storm.startAt ? `starts in ${fmt(st.storm.startAt - g.time)}` : `ends in ${fmt(st.endAt - g.time)}`} · ${st.choice === 'all' ? 'everyone sheltering' : st.choice === 'waiting' ? 'waiting crew sheltering' : 'no one sheltering'}`));
  set('sup-power', (e) => (e.textContent = `${Math.floor(g.power)}%`));
  set('powerbar', (e) => (e.style.width = `${g.power}%`));
  set('sup-tanks', (e) => (e.textContent = String(g.supplies.tanks)));
  set('sup-shield', (e) => (e.textContent = `${Math.floor(g.shield)}%`));
  set('sup-drones', (e) => (e.textContent = String(g.supplies.drones)));
  set('btn-air', (e) => ((e as HTMLButtonElement).disabled = g.power < COST_MAKE_AIR));
  set('btn-shield', (e) => ((e as HTMLButtonElement).disabled = g.power < COST_CHARGE_SHIELD || g.shield >= 100));
}

// ---------- planner ----------

export function renderPlanner(g: Game, plan: Plan, ui: UIState): string {
  const r = g.requests.find((q) => q.id === plan.requestId)!;
  const T = astro(g, r.astroId);
  const ev = evaluate(g, plan);
  const rover = plan.vehicle === 'rover';
  const canDrone = (r.kind === 'air' || r.kind === 'power' || r.kind === 'food') && g.supplies.drones > 0;
  const helpers = rover
    ? helperCandidates(g, r.id).map((h) => {
        const self = h.id === T.id;
        const trip = Math.ceil(dist(h, T) / 0.55);
        const note = self ? `${ICON.home} drives home` : `${ICON.clock}${fmt(trip)} ${ICON.air}${airHrs(h)}`;
        const stuck = roverStuck(g, h);
        const waiting = awaitingAid(g, h);
        const off = h.busy || (h.sick && !(self && mayDriveSelfHome(g, h))) || stuck || waiting;
        const tag = h.sick && !(self && mayDriveSelfHome(g, h)) ? 'Sick' : stuck ? 'Stuck' : waiting ? 'Waiting' : h.busy ? 'Busy' : plan.helperId === h.id ? 'Picked' : 'Free';
        return `<button class="opt ${plan.helperId === h.id ? 'on' : ''}" data-action="helper" data-id="${h.id}" ${off ? 'disabled' : ''}>${av(h, 'sm')}<div class="info"><span class="nm">${h.name}</span><span class="muted chips">${note}</span></div><span class="tg">${tag}</span></button>`;
      }).join('')
    : `<div class="empty nohelp">${ICON.drone} No helper!</div>`;
  const supplyRow = r.kind === 'air'
    ? `<div class="stepper"><span class="nm">Air tanks</span><button data-action="tanks" data-d="-1" ${plan.tanks <= 1 ? 'disabled' : ''} aria-label="Fewer air tanks">−</button><b>${plan.tanks}</b><button data-action="tanks" data-d="1" ${plan.tanks >= Math.min(4, g.supplies.tanks) ? 'disabled' : ''} aria-label="More air tanks">+</button></div>`
    : '';
  const left = r.due - g.time;
  const after = Math.max(0, Math.floor(g.power - ev.powerCost));
  // a guide only (nothing is rolled): short roads, rover surprises and a thin air margin all raise it
  const riskLabel = ev.chance >= 90 ? 'Low' : ev.chance >= 75 ? 'Medium' : 'High';
  const riskFill = ev.chance >= 90 ? 'mint' : ev.chance >= 75 ? 'amber' : 'coral';
  const H = rover && plan.helperId ? astro(g, plan.helperId) : null;
  const supplyIcon = r.kind === 'air' ? `${ICON.air}×${plan.tanks}` : r.kind === 'power' ? ICON.power : r.kind === 'food' ? ICON.food : r.kind === 'stuck' ? ICON.rover : '';
  const leg = (time: string, cargo: string) => `<div class="jl"><span class="jv">${rover ? ICON.rover : ICON.drone}${cargo}</span><span class="line"></span><span class="jt">${ICON.clock}${time}</span></div>`;
  const hqNode = `<div class="jn"><div class="av" style="--c:#fff">${ICON.home}</div><span>HQ</span></div>`;
  const node = (a: Astro) => `<div class="jn">${av(a)}<span>${a.name}</span></div>`;
  let journey = `<div class="empty">Pick a helper</div>`;
  if (!rover || H) {
    const pickup = r.kind === 'home' && H && H.id !== T.id;
    const leg1 = pickup ? Math.ceil((dist(H!, T) / ROVER_SPEED) * (plan.route === 'safe' ? SAFE_ROUTE_FACTOR : 1)) : ev.duration;
    const start = rover ? node(H!) : hqNode;
    const homeNode = `<div class="jn"><div class="av" style="--c:var(--mint)">${ICON.home}</div><span>Home</span></div>`;
    journey = r.kind === 'home'
      ? (pickup ? `${start}${leg(fmt(leg1), '')}${node(T)}${leg(fmt(ev.duration - leg1), '')}${homeNode}` : `${node(T)}${leg(fmt(ev.duration), '')}${homeNode}`)
      : `${start}${leg(fmt(ev.duration), supplyIcon)}${node(T)}`;
  }
  const steps = `<div class="journey">${journey}</div>`;
  return `<div class="screen">
  <header class="hdr">
    <div style="display:flex;align-items:center;gap:20px"><button class="pill" data-action="back">← Back</button><h1 style="color:#fff;font-size:34px">Plan a rescue</h1></div>
    <div style="display:flex;align-items:center;gap:10px"><button class="pill sm" data-action="prev" aria-label="Previous call">‹</button>
      <div class="card" style="padding:8px 18px;display:flex;align-items:center;gap:12px">${av(T, 'sm')}<span class="hdr-need" aria-label="${requestText(g, r)}">${needBadge(r)}<span class="tm">${ICON.clock}<b>${fmt(left)}</b></span></span></div>
      <button class="pill sm" data-action="next" aria-label="Next call">›</button></div>
  </header>
  <div class="pl-body">
    <div class="pl-l">
      <h2 class="sec">1. Pick a helper</h2>${helpers}
      <h2 class="sec" style="margin-top:6px">2. Pick your gear</h2>
      <div class="grid2">
        <button class="opt v ${rover ? 'on' : ''}" data-action="vehicle" data-v="rover"><span class="big-v">${ICON.rover}</span><span class="nm">Rover</span><span class="muted chips">${ICON.home}${ICON.rover}</span></button>
        <button class="opt v ${!rover ? 'on' : ''}" data-action="vehicle" data-v="drone" ${canDrone ? '' : 'disabled'}><span class="big-v">${ICON.drone}</span><span class="nm">Drone</span><span class="muted chips">${canDrone ? `<b>×${g.supplies.drones}</b>` : `${ICON.warn} supplies only`}</span></button>
      </div>
      ${supplyRow}
      ${rover ? `<div class="grid2">${(['short', 'safe'] as const).map((rt) => { const e = evaluate(g, { ...plan, route: rt }); return `<button class="opt v ${plan.route === rt ? 'on' : ''}" data-action="route" data-v="${rt}"><span class="nm">${rt === 'short' ? 'Short way' : 'Safe way'}</span><span class="muted chips">${ICON.clock}${fmt(e.duration)}</span><span class="muted chips">${ICON.power}−${e.powerCost}</span><span class="muted chips risk ${rt}">${ICON.warn}<i></i><i></i><i></i></span></button>`; }).join('')}</div>` : ''}
    </div>
    <div class="pl-c"><h2 class="sec">3. Your plan</h2>${steps}${r.kind === 'food' ? factHtml(r.id, FOOD_FACTS) : factHtml(ui.factIndex)}</div>
    <div class="pl-r"><h2 class="sec">How risky?</h2>
      <div class="card fc">
        <div class="risk-tile ${riskFill}" role="status" aria-label="Risk: ${riskLabel}">${ICON.warn}<span>Risk</span><b>${riskLabel}</b></div>
        <div><div class="lbl"><span>${ICON.power} Power</span><b>−${ev.powerCost}</b></div><div class="track"><div class="fill yellow" style="width:${after}%"></div></div><span class="muted chips">${ICON.power}→ ${after}%</span></div>
        <div class="sep"><span>${ICON.clock} Trip</span><b>${fmt(ev.duration)}</b></div>
        <div class="sep" style="border:0;padding:0"><span>${ICON.call} Needs help in</span><b>${fmt(left)}</b></div>
      </div>
      ${ev.reason ? `<div class="warn" role="alert">${ev.reason}</div>` : ''}
      <button class="btn-big mint" data-action="go" ${ev.valid ? '' : 'disabled'}>Go!</button>
    </div>
  </div></div>`;
}

// ---------- surprise on the trail ----------

export function renderEvent(g: Game, chosen: number | null): string {
  const pe = g.pendingEvent!;
  const m = g.missions.find((x) => x.id === pe.missionId)!;
  const r = g.requests.find((q) => q.id === m.requestId)!;
  const T = astro(g, r.astroId);
  const H = m.helperId ? astro(g, m.helperId) : null;
  const who = H ? H.name : 'The drone';
  const where = r.kind === 'home' ? (H && H.id !== T.id ? `to pick up ${T.name}` : 'back to Home base') : `to ${T.name}`;
  const pct = Math.round((m.elapsed / m.duration) * 100);
  const hasTanks = m.tanks > 1;
  const opts = pe.template.options.map((o, i) => `<button class="choice ${chosen === i ? 'on' : ''}" data-action="option" data-i="${i}" aria-pressed="${chosen === i}">
    <div class="top"><span class="nm">${o.title}</span><span class="chip">${o.cost}</span></div>
    <span>${hasTanks ? o.detailAir : o.detail}</span>
    <div class="pc"><span class="pro">${o.pro}</span><span class="con">${o.con}</span></div></button>`).join('');
  return `<div class="screen">
  <header class="hdr"><h1 style="color:#fff;font-size:32px">Lunar Mission Control</h1><span class="soft">Rescue in progress</span></header>
  <div class="alert" role="alert"><span>${pe.template.alert}</span><span>Pick fast!</span></div>
  <div class="ev-body">
    <div class="ev-l">
      <div class="card pad"><h2>What's happening?</h2><p>${pe.template.intro} ${who} is halfway ${where}. ${T.name} has ${airHrs(T)} of air left. What should ${H ? H.name : 'the drone'} do?</p></div>
      <div class="card pad"><h2>Rescue so far</h2>
        <div class="bar-row"><div class="lbl"><span>Trip</span><span>${pct}%</span></div><div class="track"><div class="fill yellow" style="width:${pct}%"></div></div></div>
        ${H ? `<div class="bar-row"><div class="lbl"><span>${H.name}'s air</span><span>${airHrs(H)}</span></div><div class="track"><div class="fill ${airColor(H)}" style="width:${airPct(H)}%"></div></div></div>` : ''}
      </div>
    </div>
    <div class="ev-r"><h2 class="sec">Pick what to do</h2>${opts}
      <button class="btn-big mint" style="margin-top:auto" data-action="confirm" ${chosen === null ? 'disabled' : ''}>${chosen === null ? 'Pick one!' : 'Do it!'}</button></div>
  </div></div>`;
}

// ---------- sun storm decision (driven by a real flare) ----------

export function renderStorm(g: Game, ui: UIState): string {
  const st = g.pendingStorm!;
  const ev = st.event;
  const field = g.astros.filter((a) => !a.home);
  const drivers = field.filter((a) => a.busy).length;
  const full = Math.min(100, Math.round(st.dosePerMin * st.duration));
  const choice = ui.stormChoice;
  const opt = (c: StormChoice, title: string, cost: string, detail: string, pro: string, con: string) => {
    const need = stormCost(st, c);
    const short = g.shield < need;
    return `<button class="choice ${choice === c ? 'on' : ''}" data-action="storm-opt" data-c="${c}" ${short ? 'disabled' : ''} aria-pressed="${choice === c}">
      <div class="top"><span class="nm">${title}</span><span class="chip">${cost}</span></div><span>${detail}</span>
      <div class="pc"><span class="pro">${short ? '' : pro}</span><span class="con">${short ? `Need ${need - Math.floor(g.shield)} more shield` : con}</span></div></button>`;
  };
  const sourceLabel = ev.source === 'live' ? (ev.provider === 'noaa' ? 'LIVE from NOAA GOES X-ray flares' : 'LIVE from NASA DONKI') : 'NASA archive (not live)';
    return `<div class="screen">
  <header class="hdr"><h1 style="color:#fff;font-size:32px">Lunar Mission Control</h1><span class="soft">Sun storm warning</span></header>
  <div class="alert" role="alert"><span>Sun storm warning! A big flare is coming!</span><span>Starts in ${fmt(st.startAt - st.warnAt)}</span></div>
  <div class="ev-body">
    <div class="ev-l tight">
      <div class="card pad"><h2>This storm is a real flare</h2>
        <div style="display:flex;gap:16px;align-items:center"><div class="flare">${ev.classType}</div><div style="display:flex;flex-direction:column;gap:2px"><b style="font:700 22px var(--head)">${ev.date}</b><span class="src">Source: ${sourceLabel}</span></div></div>
        <p>Radiation is invisible energy from the Sun. A <b>dose</b> is how much a body soaks up. Too much, and astronauts lose health.</p>
        <p class="linkline">${ev.source === 'live' ? 'Real' : 'Archive'} <b>${ev.classType}</b>, ${ev.date} → storm lasts <b>${fmt(st.duration)}</b>, shelter costs <b>${stormCost(st, 'all')} shield</b></p>
      </div>
      <div class="card pad"><h2>Your outpost right now</h2>
        <div class="bar-row"><div class="lbl"><span>Shield charge</span><span>${Math.floor(g.shield)}%</span></div><div class="track"><div class="fill mint" style="width:${g.shield}%"></div></div></div>
        <div class="bar-row"><div class="lbl"><span>Power</span><span>${Math.floor(g.power)}%</span></div><div class="track"><div class="fill yellow" style="width:${g.power}%"></div></div></div>
        <div class="bar-row"><div class="lbl"><span>Dose if the crew stays outside</span><span>${full >= 100 ? 'Too much!' : `${full}%`}</span></div><div class="track"><div class="fill ${full >= 100 ? 'coral' : 'amber'}" style="width:${full}%"></div></div></div>
        <button class="pill sm" style="align-self:flex-start" data-action="charge-storm" ${g.power >= COST_CHARGE_SHIELD && g.shield < 100 ? '' : 'disabled'}>Charge shield +${SHIELD_PER_CHARGE} · −${COST_CHARGE_SHIELD} power</button>
      </div>
      ${factHtml(ui.factIndex)}
    </div>
    <div class="ev-r"><h2 class="sec">What should Mission Control do?</h2>
      ${opt('all', 'Everyone shelters', `−${stormCost(st, 'all')} shield`, 'Everybody ducks into radiation shelters. All rescues stop until the storm is over.', '+ No radiation', '− Rescues paused')}
      ${opt('waiting', 'Shelter the waiting crew', `−${stormCost(st, 'waiting')} shield`, `Only astronauts waiting for help shelter. ${drivers ? `${drivers} driving crew keep working and soak up radiation.` : 'Nobody is driving right now.'}`, '+ Rescues keep moving', drivers ? '− Drivers get a dose' : '− Costs shield')}
      ${opt('none', 'Keep working', 'No shield used', 'Nobody shelters. Every astronaut outside soaks up radiation.', '+ Saves shield', '− Astronauts may get sick')}
      <button class="btn-big mint" style="margin-top:auto" data-action="storm-confirm" ${choice === null ? 'disabled' : ''}>${choice === null ? 'Pick one!' : 'Do it!'}</button></div>
  </div></div>`;
}

// ---------- end ----------

const STAR = (s: number) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" role="img" aria-label="Star"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" fill="#FFD23F"/></svg>`;
const STAR_OFF = (s: number) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" fill="#3B3080"/></svg>`;

export function renderEnd(g: Game, ui: UIState): string {
  const days = Math.floor(g.time / 1440);
  const hrs = Math.floor((g.time % 1440) / 60);
  const total = days ? `${days} d ${hrs} h` : `${hrs} h ${g.time % 60} m`;
  const home = g.astros.filter((a) => a.home).length;
  const sick = g.astros.filter((a) => a.sick).length;
  const stat = (l: string, v: string) => `<div class="card stat"><span class="muted">${l}</span><b>${v}</b></div>`;
  const wx = `<span class="soft">${statusText(ui.weather)}</span>`;
  if (g.over === 'win') {
    const s = stars(g);
    return `<div class="screen center"><div class="stars" aria-label="${s} out of 3 stars">${[1, 2, 3].map((i) => (i <= s ? STAR(i === 2 ? 120 : 96) : STAR_OFF(i === 2 ? 120 : 96))).join('')}</div>
    <div><h1 class="big-h" style="color:var(--mint)">Everybody's home!</h1><p class="lead" style="margin:10px auto 0">You rescued all 5 astronauts${sick === 0 ? ', and everyone stayed healthy' : `, though ${sick} got sick from radiation`}. Great job, Mission Control!</p></div>
    <div class="statrow">${stat('Brought home', '5 of 5')}${stat('Rescues', String(g.rescues))}${stat('Total time', total)}${stat('Got sick', String(sick))}</div>
    ${wx}<button class="btn-big" data-action="again">Play again</button></div>`;
  }
  return `<div class="screen center"><div class="bang" aria-hidden="true">!</div>
  <div><h1 class="big-h" style="color:var(--coral)">Oh no! ${g.loseReason.includes('health') ? 'Someone got too sick!' : 'The air ran out!'}</h1><p class="lead" style="margin:10px auto 0">${g.loseReason} Some astronauts are still waiting on the moon. Want to try a new plan?</p></div>
  <div class="statrow">${stat('Brought home', `${home} of 5`)}${stat('Rescues', String(g.rescues))}${stat('Got sick', String(sick))}</div>
  ${sick ? '<p class="soft" style="max-width:640px">Tip: a sun storm can make astronauts sick. Charge the shield with power and shelter the crew when NASA warns you.</p>' : ''}
  ${wx}<button class="btn-big" data-action="again">Try again</button></div>`;
}
