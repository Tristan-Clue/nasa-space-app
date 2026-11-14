import type { Astro, EventTemplate, ScriptItem, WeatherEvent } from './types';

/** Home base position on the map (0..100 in both directions). */
export const HQ = { x: 45, y: 90 };

export const ROVER_SPEED = 0.55; // map units per game minute
export const DRONE_SPEED = 2.2;
export const SAFE_ROUTE_FACTOR = 1.4;
export const TANK_MINUTES = 360; // one air tank = 6 hours
export const MAX_AIR = 1440; // 24 hours

// ---- the three core outpost resources: power, air, shield ----
export const POWER_REGEN_AMOUNT = 5; // solar panels add this much power...
export const POWER_REGEN_EVERY = 25; // ...once every this many minutes
export const COST_ROVER_SHORT = 8;
export const COST_ROVER_SAFE = 12; // safe way is longer, so it uses more power
export const COST_DRONE = 5;
export const COST_FOOD = 5; // a box of nasi lemak
export const FOOD_DOSE_RELIEF = 25; // comfort food: the astronaut feels stronger
export const COST_POWER_GIFT = 15; // sending power to an astronaut
export const COST_MAKE_AIR = 10; // power -> 1 air tank
export const COST_CHARGE_SHIELD = 10; // power -> +20 shield
export const SHIELD_PER_CHARGE = 20;
export const STORM_LEAD = 30; // minutes of warning

export const COLORS = {
  ines: '#FF8A8A', jonas: '#FFD23F', mateo: '#4CC9F0', priya: '#C3A6FF', hana: '#3DDC97',
};

export function makeAstros(): Astro[] {
  const mk = (id: keyof typeof COLORS, name: string, x: number, y: number, hours: number): Astro => ({
    id, name, color: COLORS[id], x, y, air: hours * 60, dose: 0, sick: false, sickSince: null, home: false, busy: false,
  });
  return [
    mk('ines', 'Ines', 22, 20, 6),
    mk('jonas', 'Jonas', 14, 68, 9),
    mk('mateo', 'Mateo', 68, 28, 18),
    mk('priya', 'Priya', 55, 58, 19),
    mk('hana', 'Hana', 80, 70, 22),
  ];
}

export function makeScripts(): Record<string, ScriptItem[]> {
  const call = (kind: ScriptItem['kind'], due: number, after = 10, need = 1): ScriptItem => ({ kind, need, due, after });
  // Each astronaut calls several times, with quiet gaps, and asks to go home last.
  // That keeps everyone out on the moon through all three sun storms.
  return {
    ines: [call('air', 240, 0, 2), call('power', 240, 100), call('home', 300, 90)],
    mateo: [call('stuck', 300, 0), call('food', 300, 100), call('air', 240, 100), call('home', 300, 90)],
    priya: [call('power', 240, 0), call('air', 240, 100), call('home', 300, 100)],
    jonas: [call('air', 240, 30), call('stuck', 300, 100), call('food', 300, 80), call('home', 300, 90)],
    hana: [call('food', 300, 240), call('air', 240, 100), call('home', 300, 100)],
  };
}

export const FIRST_CALL: Record<string, number> = { ines: 0, mateo: 0, priya: 0, jonas: 30, hana: 240 };

export const REQUEST_TEXT: Record<string, string> = {
  air: "I'm running low on air!",
  stuck: 'My rover is stuck in the dust.',
  power: 'My power pack is broken.',
  food: 'I miss nasi lemak! Please send some!',
  home: 'Please bring me home!',
};

/**
 * Real solar events documented by NASA, used ONLY when the live NASA DONKI call is not available.
 * They are shown in the game as "Archive", never as live.
 */
export const ARCHIVE: WeatherEvent[] = [
  { classType: 'X6.9', date: '8 Aug 2011', note: 'The biggest flare of Solar Cycle 24 at the time.', source: 'archive' },
  { classType: 'X6', date: 'Jul 2000', note: 'The "Bastille Day" flare started a radiation storm around Earth.', source: 'archive' },
  { classType: 'X45', date: '2003', note: 'The most powerful flare on record. Sensors cut out, so it was estimated later.', source: 'archive' },
  { classType: 'Big eruptions', date: 'Aug 1972', note: 'Between Apollo 16 and 17. A near miss for moonwalkers!', source: 'archive' },
];

export interface Fact { text: string; source: string; /** set for real data saved from a NASA API: it is a copy, not live */ saved?: string }

/** Plain-language science cards, each tied to a NASA source. */
export const FACTS: Fact[] = [
  { text: 'Solar flares are rated C, M and X. Each letter is 10 times stronger than the one before it.', source: 'NASA Goddard Scientific Visualization Studio' },
  { text: 'M-class flares can cause small radiation storms that might put astronauts in danger.', source: 'NASA Goddard Scientific Visualization Studio' },
  { text: 'On the Moon, astronauts could pile moon soil (called regolith) over a shelter to help block radiation.', source: 'NASA Goddard, "How NASA will protect astronauts from space radiation at the Moon"' },
  { text: 'For the Orion spacecraft, NASA planned for the crew to build a storm shelter out of storage bags and supplies.', source: 'NASA Goddard, 2019' },
  { text: 'Radiation adds up over time. The longer a mission, the more shielding astronauts need.', source: 'NASA Langley, Technical Paper 3079' },
  // Real data saved from the RadLab API on 14 Nov 2026. The query was: spacecraft=ISS, instrument_id=DosTel1,
  // timestamp 2022-03-01T00:00 to 01:00, absorbed_dose_rate>=0. The 65 readings ranged from 1.707 to 444.863 (RadLab units).
  { text: 'Real space station reading: in one hour on 1 March 2022, a radiation sensor on the ISS saw its dose rate jump from 1.7 to 445. That is over 250 times higher! Radiation is never steady.', source: 'NASA OSDR RadLab, ISS instrument DosTel1', saved: 'saved copy, 14 Nov 2026, not live' },
  { text: 'RadLab keeps radiation readings from the space station, from near the Moon (the LRO spacecraft and the Chang\'e 4 lander) and from Mars (the Curiosity rover).', source: 'NASA OSDR RadLab, release history' },
  // Real studies found with the OSDR search API on 14 Nov 2026 (term "spaceflight mice muscle", flight program ISS).
  { text: 'NASA flew mice on the space station for about 35 days, then checked their muscles. Scientists are looking for ways to stop muscle and bone loss in space.', source: 'NASA OSDR studies OSD-488 and OSD-660', saved: 'saved from search, 14 Nov 2026, not live' },
  { text: 'Spaceflight changes eyes too. After 35 days on the space station, scientists measured the pressure inside the eyes of NASA\'s mice.', source: 'NASA OSDR study OSD-583', saved: 'saved from search, 14 Nov 2026, not live' },
];

/** Shown in the planner when someone asks for nasi lemak (food). From the Canadian Space Agency, a NASA partner. */
export const FOOD_FACTS: Fact[] = [
  { text: 'Growing food in extreme places like space is a challenge that many northern communities in Canada face too.', source: 'Canadian Space Agency, "Food production on the Moon & remote areas" toolkit' },
  { text: 'On the Moon, liquid water is hard to find and there is no magnetic field, so plants would be hit by space radiation.', source: 'Canadian Space Agency, "Interplanetary Farming" activity' },
];

export const EVENTS: EventTemplate[] = [
  {
    id: 'hill',
    alert: 'Uh-oh! A steep hill blocks the trail!',
    intro: 'A steep, slippery hill blocks the trail.',
    options: [
      { title: 'Go around the hill', cost: '+40 min', detail: 'Take the long way around the bottom. Slow, but steady.', detailAir: 'Take the long way around the bottom. Slow, but steady.', pro: '+ Safe', con: '− Takes longer', delay: 40, risk: 0.1, loseTank: false },
      { title: 'Zoom up it!', cost: 'No delay', detail: 'Full speed up the slope. Fast, but the rover may slip.', detailAir: 'Full speed up the slope. Fast, but the rover may slip.', pro: '+ On time', con: '− Might slip', delay: 0, risk: 0.4, loseTank: false },
      { title: 'Lighten the load', cost: '+90 min', detail: 'Stop and unpack, then walk the rover up carefully.', detailAir: 'Leave one air tank behind to climb carefully. The rover is lighter.', pro: '+ Safest', con: '− Slow, maybe fewer tanks', delay: 90, risk: 0, loseTank: true },
    ],
  },
  {
    id: 'dust',
    alert: 'Whoa! A giant dust cloud!',
    intro: 'A giant dust cloud is rolling across the trail.',
    options: [
      { title: 'Take the high road', cost: '+35 min', detail: 'Climb above the cloud on the rocky ridge. Slow and safe.', detailAir: 'Climb above the cloud on the rocky ridge. Slow and safe.', pro: '+ Safe', con: '− Takes longer', delay: 35, risk: 0.1, loseTank: false },
      { title: 'Drive straight in', cost: 'No delay', detail: 'Switch on the headlights and drive right through the dust.', detailAir: 'Switch on the headlights and drive right through the dust.', pro: '+ On time', con: '− Easy to get stuck', delay: 0, risk: 0.4, loseTank: false },
      { title: 'Wait it out', cost: '+80 min', detail: 'Stop and let the dust settle before driving on.', detailAir: 'Stop and let the dust settle. Drop one air tank to lighten the rover.', pro: '+ Safest', con: '− Slow, maybe fewer tanks', delay: 80, risk: 0, loseTank: true },
    ],
  },
  {
    id: 'rocks',
    alert: 'Watch out! Space rocks ahead!',
    intro: 'A rocky field lies across the trail.',
    options: [
      { title: 'Weave around them', cost: '+30 min', detail: 'Steer slowly around every big rock. Careful driving!', detailAir: 'Steer slowly around every big rock. Careful driving!', pro: '+ Safe', con: '− Takes longer', delay: 30, risk: 0.1, loseTank: false },
      { title: 'Speed over the bumps', cost: 'No delay', detail: 'Hold on tight and bounce right across the rocks.', detailAir: 'Hold on tight and bounce right across the rocks.', pro: '+ On time', con: '− Very bumpy', delay: 0, risk: 0.4, loseTank: false },
      { title: 'Walk the rover over', cost: '+75 min', detail: 'Get out and guide the rover step by step.', detailAir: 'Get out and guide the rover. Leave one air tank behind to travel light.', pro: '+ Safest', con: '− Slow, maybe fewer tanks', delay: 75, risk: 0, loseTank: true },
    ],
  },
];
