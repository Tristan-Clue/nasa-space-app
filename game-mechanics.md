# Lunar Mission Control: game mechanics and use of real data

This document explains every rule in the game and exactly where real NASA (and partner) data is used. It is written for teammates and for judges. All numbers are the current values in the code; the file that holds each one is named so you can check it.

Contents
1. [The game in one minute](#1-the-game-in-one-minute)
2. [Time](#2-time)
3. [The three resources](#3-the-three-resources)
4. [Astronauts, health and sickness](#4-astronauts-health-and-sickness)
5. [Help calls](#5-help-calls)
6. [Rescues](#6-rescues)
7. [Sun storms](#7-sun-storms)
8. [Winning, losing and stars](#8-winning-losing-and-stars)
9. [How the real data is used](#9-how-the-real-data-is-used)
10. [What is simplified or made up](#10-what-is-simplified-or-made-up)
11. [Replayability](#11-replayability)
12. [Balance and testing](#12-balance-and-testing)
13. [Where things live in the code](#13-where-things-live-in-the-code)

---

## 1. The game in one minute

You are Mission Control. You sent 5 astronauts to the Moon and they cannot get home. They call for help (air, power, a tow, nasi lemak, a ride home). You plan rescues with rovers and drones, spend a small pool of **power, air and shield**, and decide what to do when **sun storms** arrive. Storms are built from real solar flares. Radiation drains astronauts' **health**.

Aimed at kids aged 7 to 12. There is very little reading: icons, numbers and bars carry most of the meaning.

**Win:** all 5 astronauts are home.
**Lose:** an astronaut runs out of air, or a sick astronaut is not home in time (section 4).

The trade-off the game teaches: power, air and shielding all compete. Power makes air and charges the shield, and every rescue trip also costs power. Spending on a storm shield today leaves less for rescues tomorrow. No choice is free.

## 2. Time

- The game clock runs in **game minutes**. Normal speed is 2 game minutes per real second; Fast is 6 (`SPEEDS` in `src/ui.ts`).
- A full careful game lasts roughly 16 game hours (about 8 minutes of real time at Normal).
- Everything below that says "minutes" or "hours" means game time. On screen, times are shown as hours and minutes with units, such as "1h 42m" or "45m", so they are never mistaken for minutes:seconds.

## 3. The three resources

| Resource | Starts at | Goes up by | Goes down by |
|---|---|---|---|
| **Power** (battery, 0 to 100) | 50 | The sun adds **+5 every 25 minutes** | Every rescue trip, sending a power pack, making air, charging the shield |
| **Air tanks** | 5 | Make 1 tank for **10 power** | Air deliveries (one tank gives an astronaut 6 hours of air) |
| **Shield** (0 to 100) | 30 | Charge **+20 for 10 power** | Sheltering the crew in a sun storm |

Drones (start with **2**) and rovers are equipment, not resources. A drone is used up while it flies and comes back to Home base after the same time again. Rovers are not counted: **every astronaut drives their own rover**, and it stays where they stop.

Power costs (`src/data.ts`):

| Action | Power |
|---|---|
| Rover, short way | 8 |
| Rover, safe way | 12 |
| Drone trip | 5 |
| Extra for a nasi lemak box | +5 |
| Extra for sending a power pack | +15 |
| Make 1 air tank | 10 |
| Charge shield (+20) | 10 |

Air: each astronaut starts with a different amount (Ines 6 h, Jonas 9 h, Mateo 18 h, Priya 19 h, Hana 22 h) and loses 1 minute of air per game minute. The cap is 24 hours.

## 4. Astronauts, health and sickness

Each astronaut has **Health** from 100% down to 0%. Kids see Health; under the hood it is a radiation **dose** (health = 100 minus dose).

What lowers health:
- **Sun storms** for anyone outside a shelter (section 7).
- **A help call left waiting too long**: the waiting astronaut loses **10** health.
- **A bumpy trip** (a surprise on the trail goes badly): the driver loses **8**, and so does a passenger on a ride home.

What raises health: a **nasi lemak** delivery gives **+25** health.

**Sickness and the timer.** At 0% health an astronaut is **sick**. A 2.5-hour countdown (`SICK_LIMIT = 150`) starts and is shown on their crew card. If they are not home when it ends, you lose.

Rules for sick astronauts:
- A sick astronaut **cannot drive anyone else**.
- **If every astronaut left on the Moon is sick**, each may drive themselves home so the game cannot get stuck. Their trip takes **1.5 times as long** (`SICK_DRIVE_FACTOR`).

Other rules about who can help (shown in the planner as a greyed card with a tag):

| Tag | Why that astronaut cannot be the helper |
|---|---|
| Busy | Already driving another rescue |
| Sick | See above |
| Stuck | Has an unresolved "my rover is stuck" call, so cannot drive anyone |
| Waiting | A rescue is already on its way to them, so they must wait for it |

An astronaut who is out driving does not receive new calls until they stop. A call they already had open is put **on hold** (greyed out), and its clock pauses until they stop. This is because help can only be sent to someone who is standing still.

## 5. Help calls

Each astronaut has a fixed list of calls that arrive one after another, with quiet gaps between them. A new call only starts after the previous one is finished (plus the gap). The last call for everyone is a **ride home**.

Call types:

| Call | Needs | Who can answer |
|---|---|---|
| Need air (shows ×1 or ×2) | Air tanks in the rover or on a drone | Rover or drone |
| Need power | A power pack | Rover or drone |
| Nasi lemak | A box of nasi lemak | Rover or drone |
| Stuck | A tow from a helper | Rover only |
| Ride home | Pickup and a ride to Home base | Rover only |

Each call has a time limit of 240 to 300 minutes. The dashboard shows it as an astronaut face, a need icon, a clock with the time left and a bar that is green, amber or red. It pulses red when under 90 minutes remain. When time runs out, the astronaut loses health (section 4) and the call gets another 2 hours.

Scripts (`makeScripts` in `src/data.ts`). The first number is the first call time; gaps are the quiet time before each next call:

| Astronaut | Calls in order | First call at |
|---|---|---|
| Ines | air ×2, power, home | 0 |
| Mateo | stuck, nasi lemak, air, home | 0 |
| Priya | power, air, home | 0 |
| Jonas | air, stuck, nasi lemak, home | 30 min |
| Hana | nasi lemak, air, home | 240 min |

When someone is rescued home, they and their helper both go home, and the helper's own "ride home" call is marked as in progress too. A sick astronaut's remaining calls are dropped and replaced by a single ride-home call.

## 6. Rescues

You plan a rescue by choosing a **helper**, **gear** and, for rovers, a **route**.

**Gear**
- **Rover**: leaves from the helper's own spot (not Home base). Can carry people, tow, and deliver supplies.
- **Drone**: flies from Home base, no helper needed, faster and cheaper, but can only carry supplies.

**Route (rovers only)**

| Route | Trip time | Power | Chance of a surprise on the trail |
|---|---|---|---|
| Short | normal | 8 | 60% |
| Safe | 1.4× longer | 12 | 25% |

Speeds: rover 0.55 map units per minute, drone 2.2. Trip time is the path length divided by speed.

**Checks.** The planner turns Go off and explains why if: there is not enough power, not enough tanks, the helper or target would run out of air before arriving, there is no drone free, the helper is unavailable (section 4), or help is already on its way.

**"How risky?" panel.** Shows one **Risk** tile (Low in green, Medium in amber, High in red), plus power, trip time and time left on the call. Risk is **only a guide and is not rolled**: a rescue the planner allows always arrives. It goes up for a rover trip on the short way (60% chance of a surprise on the trail), and when the air margin is under 90 minutes. Internally it comes from a score (97 for a drone, 80 short way, 94 safe way, minus 12 for a thin air margin, never below 40): 90 or more is Low, 75 to 89 is Medium, below 75 is High. The real consequences come from the trail surprise (extra delay and lost health), from other calls timing out while the helper is away, and from air.

**Surprises on the trail.** If a rover trip is chosen to have one, it happens halfway. The game pauses and shows three options. They come in three kinds (steep hill, dust cloud, rocks) with the same three-way choice:

| Option | Delay | Chance it goes badly | Other |
|---|---|---|---|
| Careful way | 30 to 40 min | 10% | none |
| Fast way | none | 40% | none |
| Lighten the load | 75 to 90 min | 0% | leaves one air tank behind on an air delivery |

If it goes badly the trip loses another 45 minutes and the driver loses 8 health (section 4).

**Arrival.** The target gets what they asked for. A delivery that does not cover the full need (for example 1 of 2 tanks) leaves the call open for 90 more minutes. A ride home sends both people home.

## 7. Sun storms

A storm is the game's main radiation event. **Each storm is built from a real solar flare** (section 9).

**Schedule.** Up to 4 storms per game. The warnings come at about 150, 330, 510 and 690 minutes, each shifted randomly by up to 25 minutes either way. The storm itself starts **30 minutes after the warning**, so you can prepare. When the warning arrives the game pauses and asks what to do.

**How a flare becomes a storm** (`strengthOf` and `makeStorm` in `src/game.ts`):

1. Turn the flare class (such as M2.1 or X6.9) into a number: `strength = clamp((log10(flux) + 5.5) / 2, 0, 0.85)`, where flux is the class letter's base value times its number (M = 1e-5, X = 1e-4). Classes without a letter (for example "Big eruptions" in the Aug 1972 archive item) use 0.7.
2. Storm length = `round(30 + 70 × strength)` minutes.
3. Full dose if you stay outside the whole time = `30 + 24 × strength` percent of health.
4. Shield cost to shelter everyone = `round(12 + 36 × strength)`.

Worked examples (computed from the code):

| Flare | Strength | Lasts | Dose if outside the whole storm | Shield to shelter everyone | Shield to shelter the waiting crew |
|---|---|---|---|---|---|
| M1.0 | 0.25 | 48 min | 36% | 21 | 11 |
| M2.1 | 0.41 | 59 min | 40% | 27 | 14 |
| M5.0 | 0.60 | 72 min | 44% | 34 | 17 |
| X1.0 | 0.75 | 83 min | 48% | 39 | 20 |
| X6.9 | 0.85 (cap) | 90 min | 50% | 43 | 22 |
| "Big eruptions" (1972) | 0.70 | 79 min | 47% | 37 | 19 |

Because one storm is at most about half of someone's health, it takes **two or three** exposures to make an astronaut sick, not one.

**Your three choices when a storm is announced:**

| Choice | Shield used | What happens |
|---|---|---|
| **Everyone shelters** | the full cost | No radiation, but **all rescues pause** until it ends (air still runs out) |
| **Shelter the waiting crew** | half the cost (rounded up) | Astronauts waiting for help are safe. Astronauts out driving a rescue keep working and take the dose |
| **Keep working** | none | Everyone outside takes the dose every minute of the storm |

The storm screen also lets you charge the shield with power before you choose. Choices you cannot afford are greyed out and say how much more shield you need.

## 8. Winning, losing and stars

- **Win**: all 5 astronauts home.
- **Lose (air)**: any astronaut's air reaches 0.
- **Lose (health)**: a sick astronaut is not home within 2.5 hours of getting sick.

**Stars** at the end of a win use crew health: 3 stars if nobody got sick and the average health is at least 70%; 2 stars if the average is at least 40%; otherwise 1. A loss shows a gentle message and a tip, and a Try again button.

## 9. How the real data is used

**Principle (from the challenge brief):** use real NASA data where possible, attribute it inside the game, and never present saved data as live. Every source below is labelled in the game as live, archive or saved copy.

### 9.1 Summary

| Data | Where it appears | How it is used | Live? |
|---|---|---|---|
| **NASA DONKI** solar flares | Storm screens, the dashboard storm banner, the title chip | Each storm is one real M or X class flare from the last 30 days. Its class sets the storm's length, dose and shield cost (section 7) | Live, fetched in the player's browser |
| **NOAA GOES X-ray flares** (NOAA Space Weather Prediction Center) | Same places | Used when DONKI cannot be reached. Same class-to-storm rules. Last 7 days, M and X class only | Live, labelled "LIVE from NOAA GOES" |
| **Archive of NASA-documented storms** | Same places | Used only if both live sources fail. Aug 1972 Apollo-era eruptions, a 2011 X6.9 flare, the 2000 "Bastille Day" flare and the 2003 record flare | Archive, labelled "NASA archive (not live)" |
| **RadLab** (OSDR radiation dosimetry database) | One science card | A real hour of readings from an ISS radiation sensor (section 9.4) | Saved copy, labelled not live |
| **OSDR** (Open Science Data Repository) studies | Two science cards | Real mouse spaceflight studies from the ISS, cited by study number (section 9.5) | Saved copy, labelled not live |
| **Canadian Space Agency** food toolkit (a NASA partner) | The planner, when someone asks for nasi lemak | Two "Food in space" cards | Static text with source |
| NASA Goddard and NASA Langley | Science cards | Plain-language facts about flares, shelters and shielding | Static text with source |

The title screen chip and the About screen always say what the game is using right now.

### 9.2 How the live flare data is fetched

Code: `src/spaceweather.ts`. The flow when the game opens:

1. If a result was saved in the browser in the last hour, use it (this keeps the NASA server from being called on every reload).
2. Otherwise ask **both** sources at once:
   - NASA DONKI: `https://ccmc.gsfc.nasa.gov/DONKI-API/get/FLR?startDate=...&endDate=...` (last 30 days). No key is needed. The path must **not** end in a slash. NASA moved DONKI to this address on 30 September 2026; the old `api.nasa.gov/DONKI/FLR` route returned 404 in our tests.
   - NOAA SWPC: `https://services.swpc.noaa.gov/json/goes/primary/xray-flares-7-day.json` (last 7 days). Public, no key, allows calls from a web page.
3. NASA gets **2.5 seconds** to answer with at least one flare. If it does, NASA data is used. Otherwise the NOAA list is used, so a slow or unreachable NASA server never holds up the game.
4. Only **M and X class** flares are kept (C class and smaller are too weak to matter).
5. If fewer than 3 flares are available, archive storms are added so every game has enough. The status then reads "mixed" and the game says how many are live.
6. If both sources fail, the game uses the archive only and says "NASA archive (live data not available)".

Each live event is tagged with who published it, and the storm screen shows "LIVE from NASA DONKI" or "LIVE from NOAA GOES X-ray flares" accordingly.

**Why NOAA is a fallback:** NOAA is a US Government agency, and the GOES satellites that measure these flares are a NOAA and NASA programme. The challenge's `resource.md` warns about *non*-US-government sites; NOAA is not one. It is still not on the challenge's resource list, so it is kept as a clearly labelled backup and NASA is always tried first. Ask a Space Apps mentor if you want certainty.

### 9.3 The link between the real flare and the game

The storm screen shows the link directly. For example: *"This storm is a real flare: M2.1, 10 Nov 2026 → storm lasts 59m, shelter costs 27 shield."* A bigger real flare always makes a longer, costlier storm (table in section 7). So the player's shielding decision is tied to actual recent space weather.

### 9.4 RadLab card (saved copy)

The card says: *"Real space station reading: in one hour on 1 March 2022, a radiation sensor on the ISS saw its dose rate jump from 1.7 to 445. That is over 250 times higher!"*

- **Where it came from.** RadLab Data API, retrieved 14 November 2026:
  `https://visualization.osdr.nasa.gov/radlab/api/?spacecraft=ISS&instrument_id=DosTel1&timestamp>=2022-03-01T00:00&timestamp<2022-03-01T01:00&absorbed_dose_rate>=0&format=json`
- **What the data was.** 65 readings from the DosTel1 instrument. The lowest was 1.707 and the highest 444.863. 444.863 / 1.707 is about 260.
- **Units.** The RadLab documentation we could reach does not state the units, so the card shows no unit instead of guessing one.
- **Why it is a saved copy.** In our tests the RadLab server did not send the headers a web page needs to call it from another website, so the browser cannot fetch it live. The card is labelled "saved copy, 14 Nov 2026, not live".
- Another card notes that RadLab also holds readings from near the Moon (the LRO spacecraft and the Chang'e 4 lander) and from Mars (the Curiosity rover), from RadLab's release history.

### 9.5 OSDR cards (saved copies)

Found with the OSDR search API on 14 November 2026: `https://osdr.nasa.gov/osdr/data/search?term=spaceflight mice muscle&ffield=Flight Program&fvalue=ISS`.

- **OSD-488** ("Characterizing SERCA function in murine skeletal muscles after 35 to 37 days of spaceflight") and **OSD-660** ("Toward countering muscle and bone loss with spaceflight: GSK3 as a potential target"): the card says NASA flew mice for about 35 days and that scientists are looking for ways to stop muscle and bone loss.
- **OSD-583** ("Characterization of mouse ocular responses (intraocular pressure) to a 35-day spaceflight mission"): the card says scientists measured the pressure inside the eyes of NASA's mice.

The cards only restate what the study titles say. They are saved copies because the OSDR server only allows calls from its own website.

### 9.6 Canadian Space Agency food cards

Shown in the planner when the call is nasi lemak. Sources: CSA, "Food production on the Moon & remote areas" toolkit, and the CSA "Interplanetary Farming" activity. They say that growing food in extreme places like space is also a challenge for northern communities in Canada, and that on the Moon liquid water is hard to find and there is no magnetic field, so plants would be hit by space radiation.

### 9.7 How to check or refresh the data

- Run the RadLab and OSDR URLs above in a terminal with `curl` (RadLab needs the `>=` and `<` characters URL-encoded, for example with `curl -G --data-urlencode`).
- To check live flares from a browser, run `npm run dev` and look at the chip on the title screen. If it says "NASA archive", open the browser's Network tab and look at the two flare requests.
- To make RadLab and OSDR live in the future, a small proxy would be needed because the browser cannot call them directly today.

### 9.8 What we did not use

Mars Trek and the Mars surface data are not used (there is no Mars mode). Communication delay (listed in the challenge Objectives) is not modelled because a Moon outpost has almost none.

## 10. What is simplified or made up

Not real: the astronauts, the map, the rover and drone speeds, and the numbers for power, air, trips, shield cost and how much health a storm removes. These are tuned for play. What is real is the **relationships**: bigger flares mean bigger storms, shielding costs power, radiation adds up over time, and radiation changes with conditions.

The flare-to-storm formulas (section 7) are our own simple mapping from the real flare class to game numbers. The class letters and the "10 times stronger per letter" scale are real.

## 11. Replayability

Each new game shuffles the available real flares and picks up to 4 for the storms, shifts the storm times by up to 25 minutes, and rolls the surprises on the trail at random.

We measured this over 200 games per case:

| Flare source | Storms per game | Distinct storm orders | First storm can be |
|---|---|---|---|
| Live (7 recent flares) | 4 | 181 | 7 different flares |
| Archive only | 3 | 6 | 3 different flares |

Honest limits: with archive-only data you get the same 3 big flares every game in a different order; each astronaut's list of calls is the same every game; and very large flares share the same strength cap (0.85). Possible improvements are more archive flares, a small random change to storm strength, and shuffling call timing.

## 12. Balance and testing

`npm test` runs `scripts/sim-test.ts`: three bots play 300 games each, with fixed seeds, using the real rules (no screen).

| Bot | Behaviour |
|---|---|
| careful | Charges the shield and shelters everyone when it can; makes air when tanks are low |
| lazy | Shelters only if it already has enough shield; never charges it |
| reckless | Never shelters |

Latest result (power 50, sun +5 every 25 minutes, shield 30, 2 drones): careful wins 202 of 300 (67%) with about 1 sick astronaut per game; lazy and reckless win 0. Ignoring storms is not survivable, and careful play is winnable but not easy. The test fails if careful play wins fewer than half the games or does not beat reckless play (the game is meant to be hard, but careful play must stay winnable and must pay off).

All of these knobs are plain constants in `src/data.ts` and `src/game.ts`.

## 13. Where things live in the code

| File | What it holds |
|---|---|
| `src/data.ts` | Astronauts, positions, costs, call scripts, surprises, archive storms, science cards and food cards |
| `src/spaceweather.ts` | Fetching live flares (NASA DONKI, NOAA GOES), the 2.5-second rule, caching, archive fallback, status text |
| `src/game.ts` | All rules with no screen code: clock, resources, calls, planning, storms, health, win and lose |
| `src/ui.ts` | Screens and text |
| `src/icons.ts` | Icons: Tabler (MIT), OpenMoji astronaut and rocket (CC BY-SA 4.0) |
| `src/scenery.ts` | The moon map: craters, rocks, the NASA flag, Home base, rescue trails |
| `src/main.ts` | Game loop, clicks, screen switching, window scaling |
| `scripts/sim-test.ts` | The bots |
| `README.md` | How to run, resource table, data table and credits |
| `resource.md`, `scope.md` | The challenge's resource list and scope, for reference |
