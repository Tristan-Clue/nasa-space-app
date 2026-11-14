import './style.css';
import { audio, sfx } from './audio';
import { FACTS } from './data';
import { activeRequests, chargeShield, defaultPlan, evaluate, launch, makeAir, newGame, resolveEvent, resolveStorm, tick } from './game';
import { archiveWeather, loadWeather } from './spaceweather';
import type { Game, Plan, StormChoice } from './types';
import { renderAbout, renderEnd, renderEvent, renderMain, renderPlanner, renderStorm, renderTitle, SPEEDS, updateLive, type UIState } from './ui';

const app = document.getElementById('app')!;
const stage = document.getElementById('stage')!;
// the starfield from the title screen sits behind every screen, so the whole game shares one look
const starfield = document.createElement('div');
starfield.className = 'stars-fall';
starfield.setAttribute('aria-hidden', 'true');
starfield.innerHTML = Array.from({ length: 60 }, (_, i) => `<i class="twinkle" style="left:${(i * 37) % 100}%;top:${(i * 53) % 100}%;animation-delay:${(i % 7) * 0.4}s"></i>`).join('');
stage.insertBefore(starfield, app);

// now and then a comet streaks across the sky (random place, direction, speed and size)
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
function spawnComet() {
  if (!document.hidden && !reduceMotion.matches) {
    const comet = document.createElement('i');
    comet.className = 'comet';
    const goRight = Math.random() < 0.5;
    const dx = (500 + Math.random() * 500) * (goRight ? 1 : -1);
    const dy = 150 + Math.random() * 350;
    comet.style.cssText = `left:${goRight ? Math.random() * 55 : 45 + Math.random() * 55}%;top:${Math.random() * 55}%;` +
      `--dx:${dx.toFixed(0)}px;--dy:${dy.toFixed(0)}px;--ang:${(Math.atan2(dy, dx) * 180 / Math.PI).toFixed(1)}deg;` +
      `--len:${(70 + Math.random() * 90).toFixed(0)}px;--dur:${(2.2 + Math.random() * 2.2).toFixed(2)}s`;
    comet.addEventListener('animationend', () => comet.remove());
    starfield.appendChild(comet);
  }
  setTimeout(spawnComet, 6000);
}
setTimeout(spawnComet, 2500);
const toastBox = document.createElement('div');
toastBox.id = 'toasts';
toastBox.setAttribute('aria-live', 'polite');

const ui: UIState = {
  screen: 'title', plan: null, paused: false, speed: 0, muted: false, lastVersion: -1,
  stormChoice: null, factIndex: 0, weather: { ...archiveWeather(), status: 'loading' }, menu: false,
};
let pausedBeforeMenu = false;
let g: Game = newGame(Math.random, ui.weather.events);
let eventChoice: number | null = null;
let drawn = '';

function fit() {
  // Scale the 1280x800 design to fit, then let the stage grow on the longer side so it fills the window.
  const s = Math.min(window.innerWidth / 1280, window.innerHeight / 800);
  stage.style.width = `${Math.min(window.innerWidth / s, 1800)}px`;
  stage.style.height = `${Math.min(window.innerHeight / s, 1100)}px`;
  stage.style.transform = `translate(-50%, -50%) scale(${s})`;
}
window.addEventListener('resize', fit);
fit();

function showToast(text: string) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  toastBox.appendChild(el);
  setTimeout(() => el.remove(), 4600);
}

function draw(force = false) {
  if (!force && ui.screen === 'main' && ui.lastVersion === g.version && drawn === 'main') return;
  let html = '';
  switch (ui.screen) {
    case 'title': html = renderTitle(ui); break;
    case 'about': html = renderAbout(ui); break;
    case 'main': html = renderMain(g, ui); break;
    case 'planner': html = renderPlanner(g, ui.plan!, ui); break;
    case 'event': html = renderEvent(g, eventChoice); break;
    case 'storm': html = renderStorm(g, ui); break;
    case 'end': html = renderEnd(g, ui); break;
  }
  app.innerHTML = html;
  app.appendChild(toastBox);
  ui.lastVersion = g.version;
  drawn = ui.screen;
}

function go(screen: UIState['screen']) {
  ui.screen = screen;
  if (screen === 'end' || screen === 'title') toastBox.replaceChildren();
  draw(true);
}

const newFact = () => { ui.factIndex = Math.floor(Math.random() * FACTS.length); };

function openPlanner(requestId: number) {
  ui.plan = defaultPlan(g, requestId);
  newFact();
  go('planner');
}

const openRequests = (): number[] =>
  activeRequests(g).filter((r) => r.missionId === null).sort((a, b) => a.due - b.due).map((r) => r.id);

function resetGame() {
  g = newGame(Math.random, ui.weather.events);
  ui.plan = null;
  ui.paused = false;
  eventChoice = null;
  ui.stormChoice = null;
  go('main');
}

function closeMenu() {
  ui.menu = false;
  ui.paused = pausedBeforeMenu;
  draw(true);
}

// Escape opens or closes the menu while playing the dashboard
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || ui.screen !== 'main') return;
  if (ui.menu) closeMenu();
  else { pausedBeforeMenu = ui.paused; ui.menu = true; ui.paused = true; draw(true); }
});

function patchPlan(p: Partial<Plan>) {
  ui.plan = { ...ui.plan!, ...p };
  const r = g.requests.find((q) => q.id === ui.plan!.requestId)!;
  if (p.vehicle === 'drone') ui.plan.helperId = null;
  if (p.vehicle === 'rover' && !ui.plan.helperId) ui.plan.helperId = defaultPlan(g, r.id).helperId;
  draw(true);
}

app.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
  if (!el || (el as HTMLButtonElement).disabled) return;
  const a = el.dataset.action!;
  const d = el.dataset;
  sfx.click();
  switch (a) {
    case 'start': case 'again': resetGame(); break;
    case 'about': go('about'); break;
    case 'back-title': go('title'); break;
    case 'menu': pausedBeforeMenu = ui.paused; ui.menu = true; ui.paused = true; draw(true); break;
    case 'menu-close': closeMenu(); break;
    case 'restart': ui.menu = false; resetGame(); break;
    case 'home': ui.menu = false; ui.paused = false; go('title'); break;
    case 'pause': ui.paused = !ui.paused; draw(true); break;
    case 'speed': ui.speed = Number(d.v); ui.paused = false; draw(true); break;
    case 'mute': ui.muted = !ui.muted; audio.muted = ui.muted; draw(true); break;
    case 'makeair': makeAir(g); draw(true); break;
    case 'charge': chargeShield(g); draw(true); break;
    case 'plan': openPlanner(Number(d.req)); break;
    case 'plan-urgent': { const ids = openRequests(); if (ids.length) openPlanner(ids[0]); break; }
    case 'back': go('main'); break;
    case 'prev': case 'next': {
      const ids = openRequests();
      if (!ids.length) { go('main'); break; }
      const i = ids.indexOf(ui.plan!.requestId);
      openPlanner(ids[(i + (a === 'next' ? 1 : -1) + ids.length) % ids.length]);
      break;
    }
    case 'helper': patchPlan({ helperId: d.id! }); break;
    case 'vehicle': patchPlan({ vehicle: d.v as Plan['vehicle'] }); break;
    case 'route': patchPlan({ route: d.v as Plan['route'] }); break;
    case 'tanks': patchPlan({ tanks: Math.max(1, ui.plan!.tanks + Number(d.d)) }); break;
    case 'go': {
      if (!evaluate(g, ui.plan!).valid) break;
      launch(g, ui.plan!);
      sfx.launch();
      go('main');
      break;
    }
    case 'option': eventChoice = Number(d.i); draw(true); break;
    case 'confirm': {
      if (eventChoice === null) break;
      resolveEvent(g, eventChoice);
      eventChoice = null;
      go('main');
      break;
    }
    case 'charge-storm': chargeShield(g); draw(true); break;
    case 'storm-opt': ui.stormChoice = d.c as StormChoice; draw(true); break;
    case 'storm-confirm': {
      if (!ui.stormChoice || !resolveStorm(g, ui.stormChoice)) break;
      ui.stormChoice = null;
      go('main');
      break;
    }
  }
});

// ---------- NASA space weather (live, with honest archive fallback) ----------
loadWeather().then((w) => {
  ui.weather = w;
  if (ui.screen === 'title' || ui.screen === 'about') draw(true);
  if (drawn === 'main') updateLive(app, g);
});

// ---------- game loop ----------
let last = performance.now();
let acc = 0;
let lastLive = 0;

function frame(now: number) {
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  if (ui.screen === 'main' && !ui.paused && !g.over) {
    acc += dt * SPEEDS[ui.speed];
    while (acc >= 1) {
      acc -= 1;
      if (!tick(g)) break;
    }
    for (const t of g.toasts.splice(0)) { showToast(t); sfx.good(); }
    if (g.over) {
      sfx[g.over === 'win' ? 'win' : 'lose']();
      go('end');
    } else if (g.pendingStorm) {
      ui.stormChoice = null;
      newFact();
      sfx.alert();
      go('storm');
    } else if (g.pendingEvent) {
      eventChoice = null;
      sfx.alert();
      go('event');
    } else if (ui.lastVersion !== g.version) {
      draw();
    } else if (now - lastLive > 90) {
      updateLive(app, g);
      lastLive = now;
    }
  }
  requestAnimationFrame(frame);
}

draw(true);
requestAnimationFrame(frame);

// helpers for demos and automated tests
(window as unknown as { __game: () => Game }).__game = () => g;
(window as unknown as { __showEnd: () => void }).__showEnd = () => go('end');
