export type Kind = 'air' | 'stuck' | 'power' | 'food' | 'home';
export type Vehicle = 'rover' | 'drone';
export type Route = 'short' | 'safe';
export type StormChoice = 'all' | 'waiting' | 'none';

export interface Pt { x: number; y: number }

export interface Astro {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  /** minutes of air left */
  air: number;
  /** radiation dose, 0..100. Shown to players as Health = 100 - dose. At 100 the astronaut is sick. */
  dose: number;
  sick: boolean;
  /** game minute when the astronaut got sick, or null. They must be home within SICK_LIMIT minutes. */
  sickSince: number | null;
  home: boolean;
  busy: boolean;
}

export interface Request {
  id: number;
  astroId: string;
  kind: Kind;
  need: number;
  due: number;
  done: boolean;
  missionId: number | null;
}

export interface Plan {
  requestId: number;
  helperId: string | null;
  vehicle: Vehicle;
  route: Route;
  tanks: number;
}

export interface Mission {
  id: number;
  requestId: number;
  helperId: string | null;
  vehicle: Vehicle;
  route: Route;
  tanks: number;
  path: Pt[];
  duration: number;
  elapsed: number;
  eventAt: number | null;
  eventDone: boolean;
  delayed: number;
}

export interface ScriptItem { kind: Kind; need: number; due: number; /** minutes of quiet after the previous call is done (default 10) */ after?: number }

export interface EventOption {
  title: string; cost: string; detail: string; detailAir: string; pro: string; con: string;
  delay: number; risk: number; loseTank: boolean;
}
export interface EventTemplate { id: string; alert: string; intro: string; options: EventOption[] }
export interface PendingEvent { missionId: number; template: EventTemplate; chosen: number | null }

/** A real (or archived) solar event used to build a game storm. */
export interface WeatherEvent {
  classType: string;
  date: string;
  note: string;
  source: 'live' | 'archive';
  /** who published a live event: NASA DONKI, or NOAA's GOES X-ray flare list */
  provider?: 'nasa' | 'noaa';
}

export interface Storm {
  warnAt: number;
  startAt: number;
  duration: number;
  /** 0..1 how strong, scaled from the real flare class */
  s: number;
  dosePerMin: number;
  shieldCost: number;
  event: WeatherEvent;
}

export interface ActiveStorm { storm: Storm; endAt: number; choice: StormChoice }

export interface Step { n: number; title: string; detail: string; time: string }

export interface EvalResult {
  valid: boolean;
  reason: string;
  duration: number;
  path: Pt[];
  powerCost: number;
  chance: number;
  danger: 'Low' | 'Medium';
  eventProb: number;
  steps: Step[];
}

export interface Game {
  time: number;
  /** HQ battery 0..100 */
  power: number;
  /** HQ radiation shield charge 0..100 */
  shield: number;
  astros: Astro[];
  requests: Request[];
  missions: Mission[];
  supplies: { tanks: number; drones: number };
  scripts: Record<string, ScriptItem[]>;
  nextSpawn: Record<string, number>;
  returns: { at: number }[];
  storms: Storm[];
  pendingStorm: Storm | null;
  storm: ActiveStorm | null;
  nextId: number;
  rescues: number;
  pendingEvent: PendingEvent | null;
  over: null | 'win' | 'lose';
  loseReason: string;
  toasts: string[];
  version: number;
  rng: () => number;
}
