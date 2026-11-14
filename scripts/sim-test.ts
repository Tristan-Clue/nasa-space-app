// Headless playthroughs: bots with different strategies play many games.
// Checks the game is winnable, that trade-offs matter (careless play does worse), and no rule breaks.
// Run with: npm test
import { activeRequests, chargeShield, defaultPlan, evaluate, helperCandidates, launch, makeAir, newGame, resolveEvent, resolveStorm, stormCost, tick } from '../src/game';
import type { Game, StormChoice } from '../src/types';

function mulberry(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

type Strategy = 'careful' | 'reckless' | 'lazy';

function botPlan(g: Game, safe: boolean) {
  const open = activeRequests(g).filter((r) => r.missionId === null).sort((a, b) => a.due - b.due);
  for (const r of open) {
    const base = defaultPlan(g, r.id);
    const options = [base, ...helperCandidates(g, r.id).map((h) => ({ ...base, vehicle: 'rover' as const, helperId: h.id }))];
    for (const o of options) {
      for (const route of safe ? (['safe', 'short'] as const) : (['short', 'safe'] as const)) {
        const plan = { ...o, route };
        if (evaluate(g, plan).valid) { launch(g, plan); return; }
      }
    }
  }
}

function decideStorm(g: Game, s: Strategy) {
  const st = g.pendingStorm!;
  let choice: StormChoice = 'none';
  if (s === 'careful') {
    choice = 'all';
    while (g.shield < stormCost(st, 'all') && chargeShield(g)) { /* spend power to charge */ }
    if (g.shield < stormCost(st, 'all')) choice = g.shield >= stormCost(st, 'waiting') ? 'waiting' : 'none';
  } else if (s === 'lazy') {
    choice = g.shield >= stormCost(st, 'all') ? 'all' : 'none';
  }
  if (!resolveStorm(g, choice)) resolveStorm(g, 'none');
}

function play(seed: number, s: Strategy) {
  const g = newGame(mulberry(seed));
  let guard = 0;
  while (!g.over && guard++ < 9000) {
    if (g.pendingStorm) { decideStorm(g, s); continue; }
    if (g.pendingEvent) { resolveEvent(g, seed % 3 === 0 ? 1 : 0); continue; }
    // every bot makes air when tanks run low (a player must too); only careful also keeps the shield charged for storms
    if ((s !== 'lazy' || g.time % 15 === 0) && g.supplies.tanks < 3 && g.power > 40) makeAir(g);
    if (g.time % 5 === 0) botPlan(g, s === 'careful' ? seed % 2 === 0 : false);
    tick(g);
  }
  for (const a of g.astros) if (a.home && a.busy) throw new Error('home astronaut still busy');
  if (g.supplies.drones < 0 || g.supplies.tanks < 0 || g.power < -0.001 || g.shield < 0) throw new Error('negative resource');
  return g;
}

const RUNS = 300;
let allOk = true;
const results: Record<string, number> = {};
for (const s of ['careful', 'lazy', 'reckless'] as Strategy[]) {
  let wins = 0; const reasons: Record<string, number> = {}; const times: number[] = []; let sick = 0;
  for (let seed = 1; seed <= RUNS; seed++) {
    const g = play(seed, s);
    sick += g.astros.filter((a) => a.sick).length;
    if (g.over === 'win') { wins++; times.push(g.time); } else { const k = g.loseReason || 'timeout'; reasons[k] = (reasons[k] ?? 0) + 1; }
  }
  times.sort((a, b) => a - b);
  console.log(`${s.padEnd(9)} wins ${String(wins).padStart(3)}/${RUNS}  sick astronauts/game ${(sick / RUNS).toFixed(2)}  median game minutes ${times[Math.floor(times.length / 2)] ?? '-'}  losses ${JSON.stringify(reasons)}`);
  results[s] = wins;
  if (s === 'careful' && wins < RUNS * 0.5) allOk = false; // the game is meant to be hard, but careful play must stay winnable
}
if (results.careful <= results.reckless) allOk = false; // preparing for storms must beat ignoring them
if (!allOk) throw new Error('careful play should win about half the games or more, and beat reckless play');
