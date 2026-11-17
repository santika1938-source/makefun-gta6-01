// Pedestrians: the people of Solmar Bay. They stroll the sidewalks, cross at corners,
// flee from speeding cars and crashes, and fall when a car hits them hard. A fallen
// pedestrian is a crime the police notice.

import { PALETTE, PED } from './config.js';

const SHIRTS = PALETTE.pedShirt;

export function createPed(x, y, random) {
  return {
    x, y,
    angle: random() * Math.PI * 2,
    speed: PED.walkSpeed * (0.7 + random() * 0.6),
    shirt: SHIRTS[Math.floor(random() * SHIRTS.length)],
    state: 'walk', // walk | flee | down
    stateTime: 0,
    legPhase: random() * Math.PI * 2,
    // The sidewalk line they stroll along: 'h' follows a road's y, 'v' follows its x.
    axis: random() < 0.5 ? 'h' : 'v',
    line: 0,
    dir: random() < 0.5 ? 1 : -1,
  };
}

export function spawnPeds(city, random, ax, ay, count) {
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    const p = city.randomSidewalkPoint();
    const dx = p.x - ax;
    const dy = p.y - ay;
    if (dx * dx + dy * dy < 300 * 300) continue;
    const ped = createPed(p.x, p.y, random);
    ped.axis = Math.abs(p.y - Math.round(p.y / 450) * 450) < 60 ? 'h' : 'v';
    ped.line = ped.axis === 'h' ? p.y : p.x;
    ped.angle = ped.axis === 'h' ? (ped.dir > 0 ? 0 : Math.PI) : (ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    peds.push(ped);
  }
  return peds;
}

/** Frighten every pedestrian within `radius` of (x, y): they run from the spot. */
export function scarePeds(peds, x, y, radius) {
  for (let i = 0; i < peds.length; i += 1) {
    const ped = peds[i];
    if (ped.state === 'down') continue;
    const dx = ped.x - x;
    const dy = ped.y - y;
    if (dx * dx + dy * dy > radius * radius) continue;
    ped.state = 'flee';
    ped.stateTime = 1.6 + Math.random() * 1.2;
    ped.angle = Math.atan2(dy, dx);
  }
}

export function stepPeds(peds, dt, city, cars) {
  for (let i = 0; i < peds.length; i += 1) {
    const ped = peds[i];
    ped.legPhase += dt * (ped.state === 'flee' ? 14 : 7);
    if (ped.state === 'down') {
      ped.stateTime -= dt;
      if (ped.stateTime <= 0) {
        ped.state = 'flee';
        ped.stateTime = 2;
      }
      continue;
    }
    if (ped.state === 'flee') {
      ped.stateTime -= dt;
      if (ped.stateTime <= 0) ped.state = 'walk';
    }
    const speed = ped.state === 'flee' ? PED.fleeSpeed : ped.speed;
    // A fast car nearby spooks walkers into fleeing.
    if (ped.state === 'walk') {
      for (let c = 0; c < cars.length; c += 1) {
        const car = cars[c];
        if (Math.abs(car.speed) < 200) continue;
        const dx = ped.x - car.x;
        const dy = ped.y - car.y;
        if (dx * dx + dy * dy < 140 * 140) {
          ped.state = 'flee';
          ped.stateTime = 1.5;
          ped.angle = Math.atan2(dy, dx);
          break;
        }
      }
    }
    if (ped.state === 'flee') {
      ped.x += Math.cos(ped.angle) * speed * dt;
      ped.y += Math.sin(ped.angle) * speed * dt;
    } else {
      // Stroll along the sidewalk line; turn around at the block's ends.
      if (ped.axis === 'h') {
        ped.x += ped.dir * speed * dt;
        ped.y = ped.line;
        if (city.isOnRoad(ped.x + ped.dir * 40, ped.y) || ped.x < 200 || ped.x > 3400) {
          ped.dir *= -1;
          ped.angle = ped.dir > 0 ? 0 : Math.PI;
        }
      } else {
        ped.y += ped.dir * speed * dt;
        ped.x = ped.line;
        if (city.isOnRoad(ped.x, ped.y + ped.dir * 40) || ped.y < 200 || ped.y > 3400) {
          ped.dir *= -1;
          ped.angle = ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        }
      }
    }
    ped.x = Math.max(60, Math.min(3540, ped.x));
    ped.y = Math.max(60, Math.min(3540, ped.y));
    city.collideCircle(ped, PED.radius);
  }
}
