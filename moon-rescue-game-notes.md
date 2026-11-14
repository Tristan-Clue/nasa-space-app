# Lunar Mission Control: game notes

Status (Sat 14 Nov 2026, day 1 of Space Apps): playable build with the trade-off layer, health as the losing factor, real flare data and saved NASA science cards. Single-player 2D mission-control game for ages 7 to 12. Full rules and data details are in `game-mechanics.md`.

## Pitch
The player is mission control. Five astronauts you sent are stuck on the moon. Read their requests, plan rescues (who goes, which vehicle, supplies, route), handle surprises, and bring everyone home before the sun makes them sick. Win: all 5 home. Lose: anyone runs out of air, or a sick astronaut is not home within 2.5 hours.

Team flavour: we are team **Bring Nasi Lemak to The Moon**, so three astronauts (Hana, Mateo, Jonas) call asking for a nasi lemak delivery. A drone or rover can bring it (5 power), and it restores 25 health. Not needed to win.

## Health (the losing factor)
Each astronaut has Health from 100% down (kids see Health; under the hood it is radiation dose, health = 100 - dose). Sun storms drain it for anyone outside. Late help calls and bumpy trips also cost health. At 0% the astronaut is sick and has 2.5 hours to get home, or you lose. The old Boss Watch meter was removed.

## How it matches the NASA brief (Junior Astronaut Mission Trainer)
- **Real trade-offs, no free choice:** three core resources (Power, Air, Shield). Power makes air and charges the shield, and rescue trips spend it. Sun storms force a choice: everyone shelters (costs shield, rescues pause), shelter the waiting crew (half the cost, drivers get a dose), or keep working (free, but astronauts may get sick).
- **Real data:** each storm is built from a real M or X class flare from NASA DONKI (live from the CCMC DONKI API, fetched in the browser, no key needed; if that server cannot be reached the game uses NOAA's live GOES X-ray flare list and says so). If both live calls fail, it uses NASA-documented archive storms and says so on screen. Static data is never shown as live.
- **Attribution in the tool:** "About the NASA data" screen, a status chip, and a source line on every science card and storm.
- **Plain language:** radiation and dose are explained in context. Large text, short sentences.
- **Replayability:** storms are drawn from different flares and timings each game, plus random surprises on the trail.
- **Few systems:** 3 core resources. Drones are equipment (2, they fly back to Home base). Rovers are not counted: every astronaut drives their own rover, which stays where they stop.
- **Gentle failure:** "Oh no! Someone got too sick!" with a tip, and a Try again button.

## Decisions
- Stack: Vite + TypeScript + plain HTML/CSS, no backend, no game engine. Builds to one `index.html`.
- Content is data (`src/data.ts`). Rules are separate from the screens (`src/game.ts`), so bots can test them (`npm test`).
- Balance check (300 games per bot): careful 202/300 (67%), never sheltering 0/300 with 2+ sick astronauts per game. Start: power 50, shield 30, 2 drones; solar adds +5 power every 25 minutes. Each astronaut drives their own rover (it stays where they stop); drones fly back. If everyone left is sick, each can drive themself home at 1.5x trip time.

## Not done yet
- RadLab and OSDR cannot be called live from a web page (no cross-site access in our tests), so the cards use real results saved on 14 Nov 2026 and say so. A tiny proxy would make them live.
- The CCMC DONKI server timed out in our sandbox and in a team browser (14 Nov 2026), so DONKI was only tested with mocked responses. The NOAA backup was checked live from the sandbox (public JSON, 7 recent M-class flares). Please open the playable file once online and check the title chip: "LIVE from NASA DONKI" or "LIVE from NOAA GOES".
- Ideas: a Mars outpost mode (Mars Trek), a first-rescue tutorial, more archive flares and random storm strength so the offline fallback varies more.

## For the judges write-up
Datasets used and why: NASA DONKI (real solar flares set how strong each sun storm is), NOAA GOES X-ray flares (a labelled live backup when DONKI cannot be reached), NASA-documented archive storms (honest fallback), RadLab (a real hour of ISS radiation readings, saved copy), OSDR (real ISS mouse studies, saved copy), the Canadian Space Agency food toolkit (food cards for the nasi lemak calls), and sourced science cards from NASA Goddard and NASA Langley TP-3079. The astronauts and the numbers for power, air and trips are simplified for play.
