# Lunar Mission Control

A 2D mission-control game for kids aged 7 to 12, built for the NASA Space Apps Challenge 2026 (Junior Astronaut Mission Trainer) by team **Bring Nasi Lemak to The Moon**. Three astronauts ask for a nasi lemak delivery along the way (drone or rover, small power cost, and it makes them feel stronger).

You sent 5 astronauts to the moon and now they can't get home. Run Mission Control: read their help calls, plan rescues, and spend **power, air and radiation shielding** wisely. Sun storms built from **real solar flare data** (NASA DONKI, with a labelled NOAA backup) force hard choices. Keep everyone healthy and bring them all home.

No backend, no engine: Vite + TypeScript + plain HTML/CSS. Plays in any browser, no account.

## Run it

    npm install
    npm run dev        # play at http://localhost:5173
    npm run build      # writes dist/index.html, one file you can open by double-click
    npm test           # bots play 900 games headlessly to check the rules and the trade-offs

## The trade-off (what the game teaches)

Three core outpost resources, and no choice is free:

| Resource | Where it comes from | What spends it |
|---|---|---|
| **Power** (battery) | Start at 50. Solar panels add +5 every 25 minutes | Every rescue trip, sending power to a broken pack, making air, charging shield |
| **Air tanks** | Start with 5. Power makes more (10 power = 1 tank) | Air deliveries to astronauts |
| **Shield** | Start at 30. Power charges it (10 power = +20 shield) | Sheltering the crew during a sun storm |

Examples of real trade-offs a player faces:
- Spend 10 power on an air tank, or keep it for the next rescue trip?
- The safe route is slower and uses more power. The short route is quicker but surprises happen more.
- A sun storm is coming. Shelter everyone (costs shield, all rescues pause), shelter only the waiting crew (cheaper, but drivers get a radiation dose), or keep working (free, but astronauts may get sick and have to be brought home within 2.5 hours).

**Health is the losing factor.** Every astronaut has Health (100% down to 0%; under the hood it is radiation dose). Sun storms drain it for anyone outside, and late help calls and bumpy trips cost some too. At 0% an astronaut gets sick and must be home within 2.5 hours, or you lose. You also lose if anyone runs out of air.

Bot tests show the lesson lands: a bot that shelters the crew wins about 67% of games (202 of 300), while a bot that never shelters loses every game (0 of 300), with 2 or more sick astronauts per game. Each astronaut drives their own rover (it stays where they stop); there are 2 drones, which fly back to Home base. Sick astronauts can't drive others, but if everyone left is sick they can drive themselves home, slowly (1.5x trip time).

## Real NASA data

| Data | How it is used | Live or archive |
|---|---|---|
| **NASA DONKI** (Space Weather Database Of Notifications, Knowledge, Information) solar flares, via the CCMC DONKI API (no key needed) | Each sun storm is built from a real M or X class flare from the last 30 days: its class sets the storm's length, radiation dose and shield cost | **Live**, fetched in the player's browser. Cached for 1 hour. |
| **NOAA GOES X-ray flares** (NOAA Space Weather Prediction Center public JSON, no key) | Used when NASA DONKI cannot be reached in 2.5 seconds: M and X class flares from the last 7 days, same game rules | **Live**, labelled "LIVE from NOAA GOES X-ray flares" |
| **Archive of NASA-documented storms** (2011 X6.9, 2000 "Bastille Day" X6, 2003 record flare, Aug 1972 eruptions between Apollo 16 and 17) | Used only if both live calls fail (offline, rate limit) | **Archive**. Always labelled "NASA archive (not live)". |
| **Science cards** with sources (NASA Goddard, NASA Langley TP-3079, NASA OSDR, RadLab) | Short plain-language facts in the planner and storm screens | Static text, each card names its source |
| **RadLab** (OSDR radiation dosimetry database) real ISS dose-rate readings | One science card shows a real hour of readings from the ISS instrument DosTel1 on 1 Mar 2022 (1.7 up to 445, over 250x). Query: `https://visualization.osdr.nasa.gov/radlab/api/?spacecraft=ISS&instrument_id=DosTel1&timestamp>=2022-03-01T00:00&timestamp<2022-03-01T01:00&absorbed_dose_rate>=0&format=json` | **Saved copy** (retrieved 14 Nov 2026), labelled "not live". The RadLab server does not allow calls from other web pages. |
| **OSDR search API** real space biology studies | Two cards cite real mouse studies from the ISS (OSD-488, OSD-660, OSD-583). Found with `https://osdr.nasa.gov/osdr/data/search?term=spaceflight mice muscle&ffield=Flight Program&fvalue=ISS` | **Saved copy** (retrieved 14 Nov 2026), labelled "not live". The OSDR server only allows its own site. |
| **Canadian Space Agency** food toolkit (NASA partner) | Two food cards shown when an astronaut asks for nasi lemak | Static text with source |

The game always shows which source is in use (chip on the title screen, line on the control room, label on every storm). Static data is never presented as live. The "About the NASA data" screen explains this to players and judges.

**Not real:** the astronauts, the map and the numbers for power, air and trips are simplified for play. The *relationships* (shielding, power and air compete; bigger flares mean bigger storms; radiation adds up) are the real idea.

### Not yet used (ideas for day 2)

- **Live RadLab and OSDR calls:** the browser cannot call them directly today (no cross-site access), so the game ships saved copies. A small proxy would make them live.
- **Mars Trek / Mars photos:** a Mars outpost mode.

## Full rules and data

See [game-mechanics.md](game-mechanics.md) for every game rule, the exact numbers, and how each real NASA (and partner) dataset is used.

## Where things live

| File | What it holds |
|---|---|
| `src/data.ts` | Astronauts, positions, costs, who asks for what and when, surprise events, archive storms, science facts. **Edit this to rebalance or add content.** |
| `src/spaceweather.ts` | Live flare fetch (NASA DONKI first, NOAA GOES backup after 2.5 seconds), parsing, caching, and the archive fallback. |
| `src/game.ts` | All rules (no DOM): clock, resources, requests, planning, storms, win/lose. |
| `src/ui.ts` | Screen rendering. |
| `src/icons.ts` | Inline Tabler SVG icons and the OpenMoji images (licenses in the file header). |
| `src/scenery.ts` | The moon map: craters, rocks, the team flag, Home base and rescue trails. |
| `src/main.ts` | Game loop, clicks, screen switching, scaling to the window. |
| `scripts/sim-test.ts` | Headless bots with three strategies (careful, lazy, reckless). |
| `game-mechanics.md` | Every rule, the exact numbers, and how the real data is used. |
| `scope.md`, `resource.md` | The challenge scope and resource list, for reference. |

## Credits

Icons: [Tabler Icons](https://tabler.io/icons) (MIT) and [OpenMoji](https://openmoji.org) astronaut and rocket (CC BY-SA 4.0, attribution to the OpenMoji contributors). Fonts: Fredoka and Nunito from Google Fonts (SIL Open Font License). Space weather: NASA DONKI (CCMC) and the NOAA Space Weather Prediction Center GOES X-ray flare list. Science facts: NASA Goddard Space Flight Center, NASA Langley Research Center, NASA Open Science Data Repository (OSDR) and RadLab. Food facts: Canadian Space Agency. NASA does not endorse this project; NOAA and the Canadian Space Agency do not endorse it either.
