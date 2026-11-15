// Decorative scenery for the moon map: craters, rocks, our team flag and Home base.
// All positions are in percent of the map, the same coordinate system as astronauts and HQ.
// Everything here is our own simple artwork (no outside assets) and ignores the mouse.
import type { Game, Pt } from './types';

const CRATERS: [number, number, number, number][] = [
  [8, 14, 26, 27], [66, 20, 19, 20], [48, 55, 33, 34], [10, 70, 16, 16], [76, 76, 12, 12], [34, 36, 9, 9], [88, 48, 8, 8],
];

const ROCKS: [number, number, number][] = [
  [30, 24, 1], [58, 12, 0.8], [90, 30, 1.1], [20, 52, 0.9], [72, 52, 0.8], [41, 72, 1], [92, 62, 0.9], [6, 44, 0.8], [62, 38, 0.7],
];

const rock = (s: number) =>
  `<svg width="${22 * s}" height="${14 * s}" viewBox="0 0 22 14"><path d="M1 13 L4 5 L10 1 L17 4 L21 13 Z" fill="#0A2F6E" opacity=".55"/><path d="M4 5 L10 1 L13 6 L8 9 Z" fill="#fff" opacity=".18"/></svg>`;

const FLAG = `<svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
  <path d="M6 62 V4" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
  <circle cx="6" cy="62" r="3" fill="#D3DFF5"/>
  <path d="M7 5 Q22 1 34 5 T61 5 V37 Q48 41 34 37 T7 37 Z" fill="#2FB67C" stroke="#fff" stroke-width="1.5"/>
  <circle cx="34" cy="21" r="10" fill="#fff"/>
  <circle cx="30" cy="18" r="2.4" fill="#D3DFF5"/><circle cx="38" cy="23" r="1.8" fill="#D3DFF5"/><circle cx="31" cy="26" r="1.3" fill="#D3DFF5"/>
  <g fill="#fff"><circle cx="17" cy="12" r="1"/><circle cx="52" cy="14" r="1"/><circle cx="50" cy="29" r=".8"/><circle cx="18" cy="29" r=".8"/></g>
</svg>`;

const place = (cls: string, x: number, y: number, art: string, label: string) =>
  `<div class="bld ${cls}" style="left:${x}%;top:${y}%">${art}<span class="bl">${label}</span></div>`;

/** Dashed trails for rescues in progress, so kids can see where a rover is going. */
function trails(g: Game): string {
  const lines = g.missions.map((m) => {
    const pts = m.path.map((p: Pt) => `${p.x},${p.y}`).join(' ');
    return `<polyline points="${pts}" class="trail ${m.vehicle}" vector-effect="non-scaling-stroke"/>`;
  }).join('');
  return `<svg class="trails" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>`;
}

export function mapScenery(g: Game): string {
  const craters = CRATERS.map(([x, y, w, h]) => `<div class="crater" style="left:${x}%;top:${y}%;width:${w}%;height:${h}%"></div>`).join('');
  const rocks = ROCKS.map(([x, y, s]) => `<span class="rock" style="left:${x}%;top:${y}%">${rock(s)}</span>`).join('');
  return `<div class="scenery" aria-hidden="true">${craters}${rocks}
    ${place('b-flag', 56, 80, FLAG, '')}
    ${trails(g)}</div>`;
}

/** Home base: a round landing pad with a small dome habitat, a radio mast and a red stripe. */
export const HQ_PAD = `<div class="hq-pad" aria-hidden="true"><svg width="84" height="70" viewBox="0 0 84 70">
  <ellipse cx="42" cy="54" rx="39" ry="13" fill="#030F2B" opacity=".45"/>
  <ellipse cx="42" cy="52" rx="38" ry="12" fill="#1D58B8" stroke="#fff" stroke-width="2.5"/>
  <ellipse cx="42" cy="52" rx="29" ry="8" fill="none" stroke="#fff" stroke-width="1.6" stroke-dasharray="4 4" opacity=".8"/>
  <rect x="22" y="30" width="40" height="20" rx="3" fill="#fff"/>
  <path d="M22 30 A20 16 0 0 1 62 30 Z" fill="#D3DFF5" stroke="#fff" stroke-width="1.5"/>
  <rect x="22" y="40" width="40" height="4" fill="#FC3D21"/>
  <rect x="26" y="32" width="8" height="6" rx="2" fill="#0B3D91"/><rect x="50" y="32" width="8" height="6" rx="2" fill="#0B3D91"/>
  <rect x="37" y="38" width="10" height="12" rx="3" fill="#0B3D91"/>
  <path d="M68 50 V24" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/><path d="M63 28 L73 28" stroke="#fff" stroke-width="2" stroke-linecap="round"/><circle cx="68" cy="22" r="3.5" fill="#FC3D21" stroke="#fff" stroke-width="1.5"/>
</svg></div>`;
