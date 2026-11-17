// The world: everything that lives in Solmar Bay, advanced one fixed step at a time.
// The player, traffic, pedestrians, police, missions, pickups and particles all meet
// here; step() takes the controls for the frame and returns what happened as bit flags,
// so the caller can play sounds and change screens without the world knowing about them.

import { BUSTED_FINE, CAR, PALETTE, PED, POLICE, STEP, WASTED_FINE } from './config.js';
import { createRandom } from './random.js';
import { createCity, LOCATIONS } from './city.js';
import { createCar, collideCars, driveCar, spawnCars, stepTrafficCars } from './vehicles.js';
import { spawnPeds, stepPeds, scarePeds } from './peds.js';
import { addWanted, clearWanted, createPolice, stepPolice } from './police.js';
import { createPlayer, damagePlayer, enterCar, exitCar, nearestCar, respawn, stepOnFoot, syncToCar } from './player.js';
import { applyMissionStart, createMissions, startMission, updateMissions } from './missions.js';

export const EVENT_CRASH = 1;
export const EVENT_PICKUP = 2;
export const EVENT_WANTED = 4;
export const EVENT_MISSION = 8;
export const EVENT_BUSTED = 16;
export const EVENT_WASTED = 32;
export const EVENT_PUNCH = 64;
export const EVENT_HONK = 128;

const EMPTY_CONTROLS = { x: 0, y: 0, sprint: false, brake: false, enter: false, punch: false };

function spawnPickups(city, random) {
  const pickups = [];
  for (let i = 0; i < 8; i += 1) {
    const p = city.randomSidewalkPoint();
    pickups.push({ x: p.x, y: p.y, kind: 'cash', amount: 25, bob: random() * Math.PI * 2 });
  }
  for (let i = 0; i < 4; i += 1) {
    const p = city.randomSidewalkPoint();
    pickups.push({ x: p.x, y: p.y, kind: 'health', amount: 40, bob: random() * Math.PI * 2 });
  }
  return pickups;
}

export function createWorld(makeRandom) {
  let random;
  let city;
  let player;
  let cars;
  let peds;
  let police;
  let missions;
  let pickups;
  let particles;
  let crimeCooldown;
  // The state object is created once and mutated by build(), so the reference the
  // caller holds (world.state) stays live across resets.
  const state = {
    city: null, player: null, cars: null, peds: null, police: null,
    missions: null, pickups: null, particles: null,
    time: 0, toast: null, toastTime: 0, score: 0,
  };

  function build() {
    random = makeRandom();
    city = createCity(random);
    // The player starts on the sidewalk by Mara's Garage, out of the traffic.
    player = createPlayer(LOCATIONS.garage.x, LOCATIONS.garage.y + 12);
    cars = spawnCars(city, random, player.x, player.y);
    // A fast car parked by the garage, ready for the first job.
    const starter = createCar(LOCATIONS.garage.x + 60, LOCATIONS.garage.y - 60, 0, 'sports', 'parked');
    cars.push(starter);
    peds = spawnPeds(city, random, player.x, player.y, PED.count);
    police = createPolice();
    missions = createMissions();
    pickups = spawnPickups(city, random);
    particles = [];
    crimeCooldown = 0;
    state.city = city;
    state.player = player;
    state.cars = cars;
    state.peds = peds;
    state.police = police;
    state.missions = missions;
    state.pickups = pickups;
    state.particles = particles;
    state.time = 0;
    state.toast = null;
    state.toastTime = 0;
    state.score = 0;
  }

  function toast(message, seconds) {
    state.toast = message;
    state.toastTime = seconds || 3;
  }

  function addParticles(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const angle = random() * Math.PI * 2;
      const v = (speed || 120) * (0.4 + random() * 0.8);
      particles.push({
        x, y,
        vx: Math.cos(angle) * v, vy: Math.sin(angle) * v,
        life: 0.5 + random() * 0.5, maxLife: 1,
        color, size: 3 + random() * 4,
      });
    }
    if (particles.length > 240) particles.splice(0, particles.length - 240);
  }

  function addCash(amount) {
    player.cash += amount;
    state.score += amount;
  }

  function crime(amount, reason) {
    if (crimeCooldown > 0) return;
    crimeCooldown = 2;
    addWanted(police, amount);
    if (reason) toast(reason, 2.5);
  }

  function reset() {
    build();
  }

  /**
   * One fixed step. `controls` is the movement vector plus the edge-triggered enter/punch
   * flags; `audio` may be null (screenshot staging). Returns the EVENT_* flags.
   */
  function step(dt, controls, audio) {
    controls = controls || EMPTY_CONTROLS;
    let events = 0;
    state.time += dt;
    if (state.toastTime > 0) {
      state.toastTime -= dt;
      if (state.toastTime <= 0) state.toast = null;
    }
    if (crimeCooldown > 0) crimeCooldown -= dt;

    const ctx = {
      player,
      wanted: () => police.wanted,
      setWanted: (value) => { police.wanted = Math.min(5, value); police.crimeTimer = POLICE.decayDelay; },
      addCash,
      toast,
    };

    // --- The player: drive, walk, steal, punch. ---
    if (controls.enter) {
      if (player.car) {
        exitCar(player);
        if (audio) audio.click();
      } else {
        const car = nearestCar(player, cars);
        if (car) {
          const stolen = car.driver === 'traffic';
          enterCar(player, car);
          if (audio) audio.click();
          if (stolen) {
            addWanted(police, 1);
            toast('Car stolen! The Bay PD noticed.', 2.5);
            events |= EVENT_WANTED;
          }
        }
      }
    }

    if (player.car) {
      const car = player.car;
      const crashed = driveCar(car, controls, dt, city);
      syncToCar(player);
      if (crashed) {
        events |= EVENT_CRASH;
        addParticles(car.x, car.y, '#ffb347', 10, 160);
        if (audio) audio.crash(0.6);
        crime(0);
        if (car.hp <= 0) toast('Your car is wrecked. Press E to get out.', 3);
      }
      if (audio) audio.engine(Math.abs(car.speed) / car.max, true);
    } else {
      const punched = stepOnFoot(player, controls, dt, city, peds);
      if (punched === 'punched') {
        events |= EVENT_PUNCH;
        addParticles(player.x + Math.cos(player.angle) * 40, player.y + Math.sin(player.angle) * 40, '#ffffff', 6, 100);
        if (audio) audio.punch();
        // Punching someone where the police can see it is a crime.
        let seen = false;
        for (let i = 0; i < police.cars.length; i += 1) {
          const dx = police.cars[i].x - player.x;
          const dy = police.cars[i].y - player.y;
          if (dx * dx + dy * dy < 500 * 500) { seen = true; break; }
        }
        if (seen) {
          addWanted(police, 1);
          events |= EVENT_WANTED;
        }
      }
      if (audio) audio.engine(0, false);
    }

    // --- Traffic, pedestrians, police. ---
    stepTrafficCars(cars, dt, city, random);
    stepPeds(peds, dt, city, cars);
    const busted = stepPolice(police, dt, city, player, cars, random);
    if (audio) audio.siren(police.wanted > 0, dt);

    // --- Car-to-car collisions. ---
    for (let i = 0; i < cars.length; i += 1) {
      for (let j = i + 1; j < cars.length; j += 1) {
        const impact = collideCars(cars[i], cars[j]);
        if (impact > 260) {
          events |= EVENT_CRASH;
          const mx = (cars[i].x + cars[j].x) / 2;
          const my = (cars[i].y + cars[j].y) / 2;
          addParticles(mx, my, '#ffb347', 8, 140);
          if (audio) audio.crash(impact / 600);
          const policeCar = cars[i].driver === 'police' ? cars[i] : cars[j].driver === 'police' ? cars[j] : null;
          const playerCar = cars[i].driver === 'player' ? cars[i] : cars[j].driver === 'player' ? cars[j] : null;
          if (policeCar && playerCar && impact > 300) {
            addWanted(police, 1);
            events |= EVENT_WANTED;
            toast('You hit a police cruiser!', 2.5);
          }
          if (cars[i].driver === 'player' || cars[j].driver === 'player') {
            const playerCar = cars[i].driver === 'player' ? cars[i] : cars[j];
            if (playerCar.hurtCooldown <= 0) {
              playerCar.hp -= 4;
              playerCar.hurtCooldown = 0.5;
              if (playerCar.hp <= 0) {
                playerCar.wrecked = true;
                playerCar.speed = 0;
              }
            }
          }
        }
      }
    }

    // --- Cars hitting pedestrians or the player on foot. ---
    for (let i = 0; i < cars.length; i += 1) {
      const car = cars[i];
      if (Math.abs(car.speed) < 120) continue;
      for (let p = 0; p < peds.length; p += 1) {
        const ped = peds[p];
        if (ped.state === 'down') continue;
        const dx = ped.x - car.x;
        const dy = ped.y - car.y;
        if (dx * dx + dy * dy < 34 * 34) {
          ped.state = 'down';
          ped.stateTime = 4;
          scarePeds(peds, ped.x, ped.y, 260);
          addParticles(ped.x, ped.y, '#ff6b6b', 8, 120);
          events |= EVENT_CRASH;
          if (car.driver === 'player') {
            addWanted(police, 1);
            events |= EVENT_WANTED;
            toast('You hit a pedestrian!', 2.5);
          }
          if (audio) audio.crash(0.5);
        }
      }
      if (!player.car) {
        const dx = player.x - car.x;
        const dy = player.y - car.y;
        if (dx * dx + dy * dy < 36 * 36) {
          damagePlayer(player, 15);
          player.x += (dx / (Math.hypot(dx, dy) || 1)) * 30;
          player.y += (dy / (Math.hypot(dx, dy) || 1)) * 30;
          if (audio) audio.crash(0.4);
          if (car.driver === 'police') {
            addWanted(police, 1);
            events |= EVENT_WANTED;
          }
        }
      }
    }

    // --- Pickups. ---
    for (let i = 0; i < pickups.length; i += 1) {
      const pickup = pickups[i];
      const dx = player.x - pickup.x;
      const dy = player.y - pickup.y;
      if (dx * dx + dy * dy < 34 * 34) {
        if (pickup.kind === 'cash') {
          addCash(pickup.amount);
          toast(`+$${pickup.amount} found`, 2);
          if (audio) audio.coin();
        } else {
          player.health = Math.min(100, player.health + pickup.amount);
          toast(`+${pickup.amount} health`, 2);
          if (audio) audio.pickup();
        }
        events |= EVENT_PICKUP;
        pickups.splice(i, 1);
        i -= 1;
      }
    }

    // --- Missions. ---
    const missionResult = updateMissions(missions, dt, ctx);
    if (missionResult === 'complete') {
      events |= EVENT_MISSION;
      if (audio) audio.jingle();
    } else if (missionResult === 'failed') {
      events |= EVENT_MISSION;
      clearWanted(police);
      if (audio) audio.fail();
    }

    // --- Busted / wasted. ---
    if (busted === 'busted') {
      events |= EVENT_BUSTED;
      const fine = Math.min(player.cash, BUSTED_FINE);
      player.cash -= fine;
      clearWanted(police);
      respawn(player, LOCATIONS.policeHq.x, LOCATIONS.policeHq.y - 60);
      toast(`Busted! The PD took $${fine}.`, 3);
    }
    if (player.health <= 0) {
      events |= EVENT_WASTED;
      const fine = Math.min(player.cash, WASTED_FINE);
      player.cash -= fine;
      clearWanted(police);
      respawn(player, LOCATIONS.hospital.x, LOCATIONS.hospital.y - 60);
      toast(`Wasted! The hospital took $${fine}.`, 3);
    }

    // --- Particles and damage cooldowns. ---
    for (let i = 0; i < cars.length; i += 1) {
      if (cars[i].hurtCooldown > 0) cars[i].hurtCooldown -= dt;
    }
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const pt = particles[i];
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.96;
      pt.vy *= 0.96;
      if (pt.life <= 0) particles.splice(i, 1);
    }
    // Smoke from wrecked cars.
    for (let i = 0; i < cars.length; i += 1) {
      const car = cars[i];
      if (car.wrecked && random() < 0.3) {
        particles.push({
          x: car.x + (random() - 0.5) * 20, y: car.y + (random() - 0.5) * 20,
          vx: 0, vy: -30, life: 0.9, maxLife: 0.9, color: '#555555', size: 6,
        });
      }
    }

    return events;
  }

  build();

  return {
    state,
    reset,
    step,
    /** Start the next mission and apply its setup (heat, toasts). */
    startNextMission() {
      const def = startMission(missions);
      if (!def) return null;
      applyMissionStart(missions, {
        setWanted: (value) => { police.wanted = Math.min(5, value); police.crimeTimer = POLICE.decayDelay; },
        toast,
      });
      return def;
    },
    /** The save payload: cash, missions done, best cash earned. */
    saveData() {
      return { cash: Math.floor(player.cash), done: missions.done, best: Math.floor(state.score) };
    },
    loadData(save) {
      if (!save) return;
      if (typeof save.cash === 'number') player.cash = save.cash;
      if (typeof save.done === 'number') missions.done = Math.min(save.done, missions.defs.length);
    },
    random,
    createRandom,
  };
}
