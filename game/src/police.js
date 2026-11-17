// The wanted system and the Bay PD. Crimes raise the wanted level; police cars spawn
// at the city's edges and chase the player, ramming the car or, on foot, closing in to
// make the bust. Stay clean and out of sight and the heat fades, one star at a time.

import { POLICE } from './config.js';
import { createCar } from './vehicles.js';

export function createPolice() {
  return {
    wanted: 0,
    crimeTimer: 0,
    decayTimer: 0,
    bustProgress: 0,
    siren: false,
    cars: [],
    // The last place a cruiser actually saw the player. Cruisers chase this spot,
    // not the player's live position, so breaking away and hiding loses them.
    lastSeen: null,
  };
}

/** Raise the wanted level (capped at 5) and restart the heat timer. */
export function addWanted(police, amount) {
  if (amount <= 0) return;
  police.wanted = Math.min(5, police.wanted + amount);
  police.crimeTimer = POLICE.decayDelay;
  police.decayTimer = 0;
}

export function clearWanted(police) {
  police.wanted = 0;
  police.bustProgress = 0;
  police.crimeTimer = 0;
  police.decayTimer = 0;
  for (let i = 0; i < police.cars.length; i += 1) police.cars[i].driver = 'parked';
  police.cars.length = 0;
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Keep the number of police cars on the road matched to the wanted level. */
function matchCars(police, city, random, player) {
  const want = Math.min(POLICE.maxCars, police.wanted);
  while (police.cars.length < want) {
    const p = city.randomRoadPoint(player.x, player.y, 700);
    const car = createCar(p.x, p.y, Math.atan2(player.y - p.y, player.x - p.x), 'police', 'police');
    car.speed = 300;
    police.cars.push(car);
    // A dispatched cruiser knows where the call came from.
    if (!police.lastSeen) police.lastSeen = { x: player.x, y: player.y };
  }
  while (police.cars.length > want) {
    const car = police.cars.pop();
    car.driver = 'parked';
    car.speed = 0;
  }
}

/**
 * One police step. Returns 'busted' when the player is caught on foot, else null.
 * `allCars` is the world's shared car list, so police cars collide with traffic too.
 */
export function stepPolice(police, dt, city, player, allCars, random) {
  police.siren = police.wanted > 0;
  if (police.wanted === 0) {
    if (police.cars.length > 0) matchCars(police, city, random, player);
    return null;
  }

  // The heat fades when the player stays clean and no cruiser is close.
  police.crimeTimer -= dt;
  let nearest = Infinity;
  for (let i = 0; i < police.cars.length; i += 1) {
    const dx = police.cars[i].x - player.x;
    const dy = police.cars[i].y - player.y;
    nearest = Math.min(nearest, dx * dx + dy * dy);
  }
  // A cruiser within 700 units spots the player and updates the last-known position.
  const seen = nearest < 700 * 700;
  if (seen) police.lastSeen = { x: player.x, y: player.y };
  if (police.crimeTimer <= 0 && nearest > 600 * 600) {
    police.decayTimer += dt;
    if (police.decayTimer >= POLICE.decayStep) {
      police.wanted -= 1;
      police.decayTimer = 0;
      police.crimeTimer = POLICE.decayDelay;
    }
  } else {
    police.decayTimer = 0;
  }

  matchCars(police, city, random, player);

  // Chase the last-known position: steer at its predicted spot, faster than traffic,
  // ramming to stop the player — but pull up and stop beside a player on foot, to bust.
  for (let i = 0; i < police.cars.length; i += 1) {
    const car = police.cars[i];
    if (car.wrecked) continue;
    const target = police.lastSeen || { x: player.x, y: player.y };
    const distToTarget = Math.hypot(target.x - car.x, target.y - car.y);
    const distToPlayer = Math.hypot(player.x - car.x, player.y - car.y);
    const tx = target.x + Math.cos(player.angle || 0) * (player.car ? 60 : 20);
    const ty = target.y + Math.sin(player.angle || 0) * (player.car ? 60 : 20);
    const wantAngle = Math.atan2(ty - car.y, tx - car.x);
    const diff = angleDiff(wantAngle, car.angle);
    const steer = Math.max(-1, Math.min(1, diff * 2));
    // On foot and close: stop beside the player instead of ramming through them.
    let speedTarget = POLICE.chaseSpeed - police.wanted * 10;
    if (!player.car && distToPlayer < 140) speedTarget = 0;
    else if (!seen && distToTarget < 120) speedTarget = 60; // Circling the last-known spot.
    car.speed += (speedTarget - car.speed) * Math.min(1, dt * 1.2);
    car.angle += steer * 3.0 * Math.min(1, Math.abs(car.speed) / 200) * dt;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // The city ends at the sea and the boardwalk: never drive off the map.
    if (car.x < 40 || car.x > 3560 || car.y < 40 || car.y > 3560) {
      car.x = Math.max(40, Math.min(3560, car.x));
      car.y = Math.max(40, Math.min(3560, car.y));
      car.speed *= 0.5;
    }
    city.collideCircle(car, 30);
    // Avoid piling onto the other cruisers.
    for (let j = 0; j < allCars.length; j += 1) {
      const other = allCars[j];
      if (other === car || other.driver !== 'police') continue;
      const dx = car.x - other.x;
      const dy = car.y - other.y;
      const d = Math.hypot(dx, dy);
      if (d > 0 && d < 70) {
        car.x += (dx / d) * (70 - d) * 0.5;
        car.y += (dy / d) * (70 - d) * 0.5;
      }
    }
  }

  // The bust: on foot, a cruiser that sits on the player for long enough ends the run.
  if (!player.car) {
    let close = false;
    for (let i = 0; i < police.cars.length; i += 1) {
      const car = police.cars[i];
      if (car.wrecked) continue;
      const dx = car.x - player.x;
      const dy = car.y - player.y;
      if (dx * dx + dy * dy < POLICE.bustDistance * POLICE.bustDistance && Math.abs(car.speed) < 120) {
        close = true;
        break;
      }
    }
    if (close) {
      police.bustProgress += dt;
      if (police.bustProgress >= POLICE.bustTime) return 'busted';
    } else {
      police.bustProgress = Math.max(0, police.bustProgress - dt * 2);
    }
  } else {
    police.bustProgress = 0;
  }
  return null;
}
