import type { Astro, EvalResult, Game, Mission, Plan, Pt, Request, Step, Storm, StormChoice, WeatherEvent } from './types';
import {
  COST_CHARGE_SHIELD, COST_DRONE, COST_MAKE_AIR, COST_POWER_GIFT, COST_ROVER_SAFE, COST_ROVER_SHORT, DRONE_SPEED,
  COST_FOOD, EVENTS, FIRST_CALL, FOOD_DOSE_RELIEF, HQ, MAX_AIR, POWER_REGEN_AMOUNT, POWER_REGEN_EVERY, ROVER_SPEED, SAFE_ROUTE_FACTOR, SHIELD_PER_CHARGE, STORM_LEAD,
  TANK_MINUTES, makeAstros, makeScripts,
} from './data';
import { archiveWeather } from './spaceweather';

export const DOSE_LIMIT = 100;
export const SICK_LIMIT = 150; // minutes a sick astronaut can wait to be brought home
export const SICK_DRIVE_FACTOR = 1.5; // a sick astronaut driving themself home is slow
export const LATE_HEALTH_HIT = 10; // health lost when a help call is left waiting too long
export const BUMP_HEALTH_HIT = 8; // health lost on a bumpy trip

export function newGame(rng: () => number = Math.random, events: WeatherEvent[] = archiveWeather().events): Game {
  const g: Game = {
    time: 0, power: 50, shield: 30,
    astros: makeAstros(), requests: [], missions: [],
    supplies: { tanks: 5, drones: 2 },
    scripts: makeScripts(), nextSpawn: { ...FIRST_CALL }, returns: [],
    storms: [], pendingStorm: null, storm: null,
    nextId: 1, rescues: 0, pendingEvent: null, over: null, loseReason: '', toasts: [], version: 1, rng,
  };
  g.storms = buildStorms(rng, events);
  return g;
}

// ---------- storms (built from real flare classes) ----------

const FLUX_BASE: Record<string, number> = { A: 1e-8, B: 1e-7, C: 1e-6, M: 1e-5, X: 1e-4 };

/** Game strength 0..1 from a flare class like "M2.1" or "X6.9". Capped so storms stay playable. */
export function strengthOf(classType: string): number {
  const m = /^([ABCMX])(\d+(?:\.\d+)?)$/.exec(classType);
  if (!m) return 0.7; // e.g. the 1972 eruptions have no class
  const flux = Number(m[2]) * FLUX_BASE[m[1]];
  return Math.min(0.85, Math.max(0, (Math.log10(flux) + 5.5) / 2));
}

export function makeStorm(event: WeatherEvent, warnAt: number): Storm {
  const s = strengthOf(event.classType);
  return {
    warnAt, startAt: warnAt + STORM_LEAD, duration: Math.round(30 + 70 * s), s,
    // one full storm outside is about a third to half of a person's health, so it takes 2 or 3 storms to get sick
    dosePerMin: (30 + 24 * s) / Math.round(30 + 70 * s), shieldCost: Math.round(22 + 20 * s), event,
  };
}

export function buildStorms(rng: () => number, events: WeatherEvent[]): Storm[] {
  const pool = [...events];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const base = [150, 330, 510, 690];
  return base.slice(0, Math.min(4, pool.length)).map((b, i) => makeStorm(pool[i], b + Math.round((rng() - 0.5) * 50)));
}

export function stormCost(st: Storm, choice: StormChoice): number {
  return choice === 'all' ? st.shieldCost : choice === 'waiting' ? Math.ceil(st.shieldCost / 2) : 0;
}

export function resolveStorm(g: Game, choice: StormChoice): boolean {
  const st = g.pendingStorm;
  if (!st) return false;
  const cost = stormCost(st, choice);
  if (g.shield < cost) return false;
  g.shield -= cost;
  g.storm = { storm: st, endAt: st.startAt + st.duration, choice };
  g.pendingStorm = null;
  g.version++;
  return true;
}

// ---------- the three resources ----------

export function makeAir(g: Game): boolean {
  if (g.power < COST_MAKE_AIR) return false;
  g.power -= COST_MAKE_AIR; g.supplies.tanks += 1; g.version++; return true;
}
export function chargeShield(g: Game): boolean {
  if (g.power < COST_CHARGE_SHIELD || g.shield >= 100) return false;
  g.power -= COST_CHARGE_SHIELD; g.shield = Math.min(100, g.shield + SHIELD_PER_CHARGE); g.version++; return true;
}

// ---------- helpers ----------

export const astro = (g: Game, id: string): Astro => g.astros.find((a) => a.id === id)!;
export const dist = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Time as hours and minutes with units ("1h 42m"), so it is never read as minutes:seconds. */
export function fmt(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h === 0 ? `${r}m` : r === 0 ? `${h}h` : `${h}h ${r}m`;
}

/** Kids see Health, not dose: 100% is fine, 0% is sick. */
export const healthOf = (a: Astro): number => Math.max(0, Math.round(100 - a.dose));

/** Hurt an astronaut's health (adds radiation dose). At 0% health they get sick and a 4-hour countdown starts. */
export function hurt(g: Game, a: Astro, amount: number) {
  if (a.home) return;
  a.dose = Math.min(DOSE_LIMIT, a.dose + amount);
  if (a.dose >= DOSE_LIMIT && !a.sick) {
    a.sick = true;
    a.sickSince = g.time;
    // sickness is an emergency: the astronaut must be brought home soon
    g.scripts[a.id] = [{ kind: 'home', need: 1, due: SICK_LIMIT }];
    for (const q of g.requests) if (q.astroId === a.id && !q.done) q.due = Math.min(q.due, g.time + SICK_LIMIT);
    toast(g, `${a.name}'s health ran out and they feel sick! Bring them home within ${SICK_LIMIT / 60} hours.`);
  }
}

export const activeRequests = (g: Game): Request[] => g.requests.filter((r) => !r.done);

export function requestText(g: Game, r: Request): string {
  const t = astro(g, r.astroId).name;
  switch (r.kind) {
    case 'air': return `${t} needs ${r.need} air tank${r.need > 1 ? 's' : ''}`;
    case 'power': return `${t} needs power`;
    case 'food': return `${t} wants nasi lemak`;
    case 'stuck': return `${t}'s rover is stuck`;
    default: return `${t} wants to go home`;
  }
}

function toast(g: Game, msg: string) { g.toasts.push(msg); g.version++; }
function lose(g: Game, reason: string) { if (g.over) return; g.over = 'lose'; g.loseReason = reason; g.version++; }
function pathLength(path: Pt[]): number { let t = 0; for (let i = 1; i < path.length; i++) t += dist(path[i - 1], path[i]); return t; }

export function pointAlong(path: Pt[], frac: number): Pt {
  const total = pathLength(path);
  let d = Math.min(1, Math.max(0, frac)) * total;
  for (let i = 1; i < path.length; i++) {
    const seg = dist(path[i - 1], path[i]);
    if (d <= seg || i === path.length - 1) {
      const f = seg === 0 ? 1 : Math.min(1, d / seg);
      return { x: path[i - 1].x + (path[i].x - path[i - 1].x) * f, y: path[i - 1].y + (path[i].y - path[i - 1].y) * f };
    }
    d -= seg;
  }
  return path[path.length - 1];
}

// ---------- planning ----------

/** An astronaut whose rover is stuck (an open 'stuck' call) cannot drive anyone else until they are freed. */
export const roverStuck = (g: Game, a: Astro): boolean => g.requests.some((q) => q.astroId === a.id && q.kind === 'stuck' && !q.done);

/** An astronaut who is being helped right now (a rescue is on its way to them) has to wait and cannot help anyone else. */
export const awaitingAid = (g: Game, a: Astro): boolean => g.requests.some((q) => q.astroId === a.id && !q.done && q.missionId !== null);

/**
 * A sick astronaut cannot drive others, but if everyone left on the moon is sick
 * they may drive themselves home, so the crew can never be stuck with nobody able to go.
 */
export function mayDriveSelfHome(g: Game, a: Astro): boolean {
  if (!a.sick || a.home || a.busy || roverStuck(g, a)) return false;
  return !g.astros.some((o) => o.id !== a.id && !o.home && !o.sick);
}

export function defaultPlan(g: Game, requestId: number): Plan {
  const r = g.requests.find((q) => q.id === requestId)!;
  const T = astro(g, r.astroId);
  const canDrone = (r.kind === 'air' || r.kind === 'power' || r.kind === 'food') && g.supplies.drones > 0;
  const free = g.astros
    .filter((a) => !a.home && !a.busy && !a.sick && !roverStuck(g, a) && !awaitingAid(g, a) && (a.id !== T.id || r.kind === 'home'))
    .sort((a, b) => dist(a, T) - dist(b, T));
  return {
    requestId,
    helperId: r.kind === 'home' && !T.sick && !T.busy ? T.id : r.kind === 'home' && mayDriveSelfHome(g, T) && free.length === 0 ? T.id : (free[0]?.id ?? null),
    vehicle: canDrone ? 'drone' : 'rover',
    route: 'short',
    tanks: r.kind === 'air' ? Math.min(r.need, Math.max(1, g.supplies.tanks)) : 0,
  };
}

export function helperCandidates(g: Game, requestId: number): Astro[] {
  const r = g.requests.find((q) => q.id === requestId)!;
  const T = astro(g, r.astroId);
  return g.astros
    .filter((a) => !a.home && (a.id !== T.id || r.kind === 'home'))
    .sort((a, b) => (a.id === T.id ? -1 : b.id === T.id ? 1 : dist(a, T) - dist(b, T)));
}

export function powerCostOf(vehicle: Plan['vehicle'], route: Plan['route'], kind: Request['kind']): number {
  const base = vehicle === 'drone' ? COST_DRONE : route === 'short' ? COST_ROVER_SHORT : COST_ROVER_SAFE;
  return base + (kind === 'power' ? COST_POWER_GIFT : kind === 'food' ? COST_FOOD : 0);
}

export function evaluate(g: Game, p: Plan): EvalResult {
  const r = g.requests.find((q) => q.id === p.requestId)!;
  const T = astro(g, r.astroId);
  const res: EvalResult = { valid: false, reason: '', duration: 0, path: [], powerCost: 0, chance: 0, danger: 'Low', eventProb: 0, steps: [] };
  let reason = '';
  const H = p.vehicle === 'rover' && p.helperId ? astro(g, p.helperId) : null;

  if (r.missionId !== null) reason = 'Help is already on the way!';
  // someone out driving keeps moving, so help can only be sent once they stop
  if (T.busy && r.missionId === null) reason ||= `${T.name} is out driving. Help them once they stop!`;

  if (p.vehicle === 'drone') {
    if (r.kind === 'stuck' || r.kind === 'home') reason ||= "Drones can't tow rovers or carry people.";
    if (g.supplies.drones < 1) reason ||= 'No drones are free right now.';
    res.path = [HQ, { x: T.x, y: T.y }];
  } else {
    if (!H) {
      reason ||= 'Pick a helper to drive the rover.';
      res.path = [HQ, { x: T.x, y: T.y }];
    } else {
      if (H.busy) reason ||= `${H.name} is busy with another rescue.`;
      if (awaitingAid(g, H)) reason ||= `${H.name} is waiting for help, so they can't drive!`;
      if (roverStuck(g, H)) reason ||= `${H.name}'s rover is stuck, so they can't drive!`;
      if (H.sick && !(r.kind === 'home' && H.id === T.id && mayDriveSelfHome(g, H))) reason ||= `${H.name} feels sick from radiation and can't drive anyone else.`;
      if (H.id === T.id && r.kind !== 'home') reason ||= `${T.name} can't rescue themself!`;
      if (r.kind === 'home') res.path = H.id === T.id ? [{ x: T.x, y: T.y }, HQ] : [{ x: H.x, y: H.y }, { x: T.x, y: T.y }, HQ];
      else res.path = [{ x: H.x, y: H.y }, { x: T.x, y: T.y }];
    }
  }

  if (r.kind === 'air') {
    if (p.tanks < 1) reason ||= 'Pack at least one air tank.';
    if (p.tanks > g.supplies.tanks) reason ||= 'Not enough air tanks! Make more with power.';
  }

  res.powerCost = powerCostOf(p.vehicle, p.route, r.kind);
  if (g.power < res.powerCost) reason ||= `Not enough power! This needs ${res.powerCost}, you have ${Math.floor(g.power)}.`;

  const speed = p.vehicle === 'drone' ? DRONE_SPEED : ROVER_SPEED;
  const factor = (p.vehicle === 'rover' && p.route === 'safe' ? SAFE_ROUTE_FACTOR : 1) * (H && H.sick ? SICK_DRIVE_FACTOR : 1);
  res.duration = Math.ceil((pathLength(res.path) / speed) * factor);

  let margin = Infinity;
  if (p.vehicle === 'rover' && H) {
    if (H.air <= res.duration) reason ||= `${H.name} would run out of air on the trip!`;
    margin = Math.min(margin, H.air - res.duration);
  }
  if (T.air <= res.duration) reason ||= `${T.name} would run out of air before help gets there!`;
  margin = Math.min(margin, T.air - res.duration);

  res.reason = reason;
  res.valid = !reason;
  res.eventProb = p.vehicle === 'drone' ? 0 : p.route === 'short' ? 0.6 : 0.25;
  res.danger = p.vehicle === 'rover' && p.route === 'short' ? 'Medium' : 'Low';
  const base = p.vehicle === 'drone' ? 97 : p.route === 'short' ? 80 : 94;
  res.chance = Math.max(40, base - (margin < 90 ? 12 : 0));
  res.steps = buildSteps(p, r, T, H, res.duration);
  return res;
}

function buildSteps(p: Plan, r: Request, T: Astro, H: Astro | null, duration: number): Step[] {
  const supply = r.kind === 'air' ? `${p.tanks} air tank${p.tanks > 1 ? 's' : ''}` : r.kind === 'power' ? 'a power pack' : r.kind === 'food' ? 'a box of nasi lemak' : '';
  const s: Omit<Step, 'n'>[] = [];
  if (p.vehicle === 'drone') {
    s.push({ title: `Drone loads ${supply}`, detail: 'Takes off from Home base', time: '0:00' });
    s.push({ title: `Drone flies to ${T.name}`, detail: 'Straight across the moon', time: fmt(duration) });
    s.push({ title: `${T.name} gets ${supply}`, detail: `${T.name} is helped!`, time: fmt(duration) });
  } else if (H) {
    const route = p.route === 'short' ? 'Shortest way, but surprises can happen' : 'Longer, but much safer';
    const leg1 = Math.ceil((dist(H, T) / ROVER_SPEED) * (p.route === 'safe' ? SAFE_ROUTE_FACTOR : 1));
    if (r.kind === 'home') {
      if (H.id === T.id) {
        s.push({ title: `${T.name} hops in the rover`, detail: 'Strap in and check the radio', time: '0:00' });
        s.push({ title: 'Drive back to Home base', detail: route, time: fmt(duration) });
      } else {
        s.push({ title: `${H.name} hops in the rover`, detail: 'Strap in and check the radio', time: '0:00' });
        s.push({ title: `Drive to ${T.name}`, detail: route, time: fmt(leg1) });
        s.push({ title: `Pick up ${T.name}`, detail: 'Two astronauts on board', time: fmt(leg1) });
        s.push({ title: 'Ride back to Home base', detail: 'Both astronauts are safe at home!', time: fmt(duration) });
      }
    } else if (r.kind === 'stuck') {
      s.push({ title: `${H.name} hops in the rover`, detail: 'Strap in and check the radio', time: '0:00' });
      s.push({ title: `Drive to ${T.name}`, detail: route, time: fmt(duration) });
      s.push({ title: `Pull ${T.name}'s rover free`, detail: 'Tow rope on!', time: fmt(duration) });
    } else {
      s.push({ title: `HQ beams ${supply} to ${H.name}`, detail: 'Loaded onto the rover', time: '0:00' });
      s.push({ title: `${H.name} drives to ${T.name}`, detail: route, time: fmt(duration) });
      s.push({ title: `${T.name} gets ${supply}`, detail: `${T.name} is helped!`, time: fmt(duration) });
    }
  }
  return s.map((x, i) => ({ ...x, n: i + 1 }));
}

export function launch(g: Game, p: Plan): Mission | null {
  const ev = evaluate(g, p);
  if (!ev.valid) return null;
  const r = g.requests.find((q) => q.id === p.requestId)!;
  const m: Mission = {
    id: g.nextId++, requestId: r.id, helperId: p.vehicle === 'rover' ? p.helperId : null,
    vehicle: p.vehicle, route: p.route, tanks: r.kind === 'air' ? p.tanks : 0,
    path: ev.path, duration: ev.duration, elapsed: 0, eventAt: null, eventDone: false, delayed: 0,
  };
  if (ev.eventProb > 0 && g.rng() < ev.eventProb) m.eventAt = Math.max(1, Math.floor(ev.duration * 0.5));
  if (p.vehicle === 'drone') g.supplies.drones--;
  g.supplies.tanks -= m.tanks;
  g.power -= ev.powerCost;
  if (m.helperId) astro(g, m.helperId).busy = true;
  r.missionId = m.id;
  // On a ride home the helper rides back too, so their own "bring me home" call is on the way as well.
  if (r.kind === 'home' && m.helperId && m.helperId !== r.astroId) {
    const own = g.requests.find((q) => q.astroId === m.helperId && q.kind === 'home' && !q.done && q.missionId === null);
    if (own) own.missionId = m.id;
  }
  g.missions.push(m);
  g.version++;
  return m;
}

// ---------- mid-mission surprises ----------

export function resolveEvent(g: Game, optionIndex: number): string {
  const pe = g.pendingEvent;
  if (!pe) return '';
  const m = g.missions.find((x) => x.id === pe.missionId)!;
  const o = pe.template.options[optionIndex];
  m.duration += o.delay;
  m.delayed += o.delay;
  m.eventDone = true;
  let msg = `${o.title}!`;
  if (o.loseTank && m.tanks > 1) {
    m.tanks -= 1;
    g.supplies.tanks += 1;
    msg += ' One air tank stayed behind.';
  }
  if (g.rng() < o.risk) {
    m.duration += 45;
    m.delayed += 45;
    msg += ' Bumpy! The rover lost 45 minutes and the crew lost some health.';
    if (m.helperId) hurt(g, astro(g, m.helperId), BUMP_HEALTH_HIT);
    const req = g.requests.find((q) => q.id === m.requestId);
    if (req && req.kind === 'home') hurt(g, astro(g, req.astroId), BUMP_HEALTH_HIT);
  }
  g.pendingEvent = null;
  toast(g, msg);
  return msg;
}

// ---------- the clock ----------

function spawnRequests(g: Game) {
  for (const a of g.astros) {
    if (a.home) continue;
    const queue = g.scripts[a.id];
    if (!queue || queue.length === 0) continue;
    if (g.requests.some((r) => !r.done && r.astroId === a.id)) continue;
    if (a.busy) continue; // nobody calls in while out driving a rescue; the next call waits until they stop
    if (g.time < (g.nextSpawn[a.id] ?? 0)) continue;
    const item = queue.shift()!;
    g.requests.push({ id: g.nextId++, astroId: a.id, kind: item.kind, need: item.need, due: g.time + item.due, done: false, missionId: null });
    g.version++;
  }
}

function sendHome(g: Game, a: Astro) {
  a.home = true; a.busy = false; a.x = HQ.x; a.y = HQ.y;
  g.scripts[a.id] = [];
  for (const q of g.requests) if (q.astroId === a.id && !q.done) q.done = true;
}

function completeMission(g: Game, m: Mission) {
  const r = g.requests.find((q) => q.id === m.requestId)!;
  const T = astro(g, r.astroId);
  const H = m.helperId ? astro(g, m.helperId) : null;
  g.missions = g.missions.filter((x) => x.id !== m.id);
  r.missionId = null;
  // every astronaut drives their own rover, so it stays where they stop; drones fly back to Home base
  if (m.vehicle === 'drone') g.returns.push({ at: g.time + m.duration });
  if (H) H.busy = false;
  g.rescues++;

  if (r.kind === 'home') {
    sendHome(g, T);
    if (H && H.id !== T.id) sendHome(g, H);
    toast(g, H && H.id !== T.id ? `${T.name} and ${H.name} are home!` : `${T.name} is home!`);
  } else {
    if (H) { H.x = T.x; H.y = T.y; }
    if (r.kind === 'air') {
      T.air = Math.min(MAX_AIR, T.air + m.tanks * TANK_MINUTES);
      r.need -= m.tanks;
    } else {
      r.need = 0;
      if (r.kind === 'food') T.dose = Math.max(0, T.dose - FOOD_DOSE_RELIEF);
    }
    if (r.need > 0) {
      r.due = g.time + 90;
      toast(g, `${T.name} still needs ${r.need} more. Send another rescue!`);
    } else {
      r.done = true;
      g.nextSpawn[T.id] = g.time + (g.scripts[T.id]?.[0]?.after ?? 10);
      toast(g, r.kind === 'stuck' ? `${T.name}'s rover is free!` : r.kind === 'food' ? `${T.name} enjoys the nasi lemak and feels stronger!` : `${T.name} is happy!`);
    }
  }
  g.version++;
  if (g.astros.every((a) => a.home)) g.over = 'win';
}

function stormFrozen(g: Game): boolean {
  const s = g.storm;
  return !!s && s.choice === 'all' && g.time >= s.storm.startAt && g.time < s.endAt;
}

function applyStorm(g: Game) {
  const s = g.storm;
  if (!s) return;
  if (g.time >= s.endAt) {
    g.storm = null;
    toast(g, 'The sun storm is over!');
    return;
  }
  if (g.time < s.storm.startAt || s.choice === 'all') return;
  for (const a of g.astros) {
    if (a.home) continue;
    // "waiting" means only the astronauts out driving rescues are exposed
    if (s.choice === 'waiting' && !a.busy) continue;
    hurt(g, a, s.storm.dosePerMin);
  }
}

/** Advance the game by one minute. Returns false if the clock should stop. */
export function tick(g: Game): boolean {
  if (g.over || g.pendingEvent || g.pendingStorm) return false;
  g.time++;
  if (g.time % POWER_REGEN_EVERY === 0) g.power = Math.min(100, g.power + POWER_REGEN_AMOUNT);

  for (const a of g.astros) {
    if (a.home) continue;
    a.air -= 1;
    if (a.air <= 0) { lose(g, `${a.name} ran out of air.`); return false; }
  }

  if (!g.storm && g.storms.length && g.time >= g.storms[0].warnAt) {
    g.pendingStorm = g.storms.shift()!;
    g.version++;
    return false;
  }
  applyStorm(g);

  spawnRequests(g);

  if (!stormFrozen(g)) {
    for (const m of [...g.missions]) {
      m.elapsed++;
      if (m.eventAt !== null && !m.eventDone && m.elapsed >= m.eventAt) {
        const tpl = EVENTS[Math.floor(g.rng() * EVENTS.length)];
        g.pendingEvent = { missionId: m.id, template: tpl, chosen: null };
        g.version++;
        return false;
      }
      if (m.elapsed >= m.duration) completeMission(g, m);
    }
  }
  if (g.over) return false;

  for (let i = g.returns.length - 1; i >= 0; i--) {
    if (g.time >= g.returns[i].at) { g.supplies.drones++; g.returns.splice(i, 1); g.version++; }
  }

  for (const r of g.requests) {
    // a call from someone who is out driving is on hold: its clock waits until they stop
    if (!r.done && r.missionId === null && astro(g, r.astroId).busy) { r.due++; continue; }
    if (!r.done && r.missionId === null && g.time > r.due) {
      r.due = g.time + 120;
      const w = astro(g, r.astroId);
      hurt(g, w, LATE_HEALTH_HIT);
      if (!w.sick) toast(g, `${w.name} waited too long and lost some health!`);
    }
  }

  for (const a of g.astros) {
    if (!a.home && a.sick && a.sickSince !== null && g.time - a.sickSince >= SICK_LIMIT) {
      lose(g, `${a.name}'s health ran out before they got home.`);
      return false;
    }
  }
  return true;
}

export function stars(g: Game): number {
  const avg = g.astros.reduce((t, a) => t + healthOf(a), 0) / g.astros.length;
  const sick = g.astros.filter((a) => a.sick).length;
  return sick === 0 && avg >= 70 ? 3 : avg >= 40 ? 2 : 1;
}
