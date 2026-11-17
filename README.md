# Solmar Bay — Open City Crime

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/santika1938-source/makefun-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/santika1938-source/makefun-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

A top-down 2D open-world crime game in vanilla JavaScript and canvas — no libraries,
no network requests, everything original. Explore the sun-soaked coastal city of
**Solmar Bay** on foot and by car: steal cars, dodge traffic and pedestrians, outrun
the Bay PD as your wanted level climbs, and finish four scripted missions for Mara
Voss, from her garage on Marlin Street to the Coral Casino vault.

## What is in the game

- **A procedural city** — a road grid of 64 blocks with buildings, parks, plazas,
  a beach and the sea, generated from a seed so every run plays the same city.
- **Driving** — arcade car physics with acceleration, braking, steering and drift;
  steal any parked or moving car with `E`, including a sports car by the garage.
- **Traffic and pedestrians** — cars follow the roads and turn at intersections;
  pedestrians stroll the sidewalks and flee from speeding cars and crashes.
- **Wanted level and police** — crimes (stealing, hitting pedestrians, ramming
  cruisers) raise the heat from 1 to 5 stars; Bay PD cruisers chase, ram, and
  bust you on foot. Stay clean and out of sight and the heat fades.
- **Missions and a story** — four jobs with dialogue, timers and a getaway:
  *Wheels Up*, *Sunset Delivery*, *Heat Wave* and *The Coral Heist*.
- **HUD and minimap** — cash, health, wanted stars, speed, a live minimap with
  the mission target, police and the player, plus objective and dialogue lines.
- **Sound** — synthesized WebAudio only: engine hum, police sirens, honks,
  crashes and mission jingles. `M` mutes.
- **Save** — cash and mission progress persist in localStorage between visits.

## Controls

| Key | Action |
| --- | --- |
| W A S D / arrows | Walk and drive (steer) |
| Shift | Run on foot |
| E | Enter / exit a car |
| Space | Punch on foot · handbrake in a car |
| N | Start the next mission |
| P / Esc | Pause |
| M | Mute |

## Play it

```sh
node serve.ts
# then open http://localhost:8080
```

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory and writes
`dossier.json` with the vendored make.fun library. Screenshots are staged scenes
of the real game (`?shot=start|drive|chase|mission&seed=7`), listed in `shots.json`.

## Layout

```
game/
  index.html          the page: one canvas, one module script
  src/
    main.js           boot, the fixed-step loop, screens, saving
    world.js          the rules: everything meets here each step
    city.js           procedural Solmar Bay: roads, blocks, buildings, beach
    vehicles.js       cars, driving physics, traffic AI
    peds.js           pedestrians: strolling, fleeing, falling
    police.js         wanted level and the Bay PD chase AI
    missions.js       the four jobs and Mara's story
    player.js         on foot or behind a wheel: health, cash, stealing
    render.js         camera, drawing the city, screens
    hud.js            HUD: cash, health, stars, minimap, objectives
    input.js          keyboard and pointer input
    audio.js          synthesized WebAudio: engine, siren, effects
    shots.js          the four screenshot scenes
    save.js           localStorage save / load
    config.js         tuning numbers and the palette
    random.js         seeded RNG (mulberry32)
```

MIT licensed. All names, characters, places and art are original.
