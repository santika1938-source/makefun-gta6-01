// Cars: what they are, how the player drives one, and how traffic drives itself.
// A car is a point with a heading and a forward speed; driving is arcade physics —
// accelerate, steer, brake, a little drift — and traffic follows the road grid, turning
// at intersections and slowing for the car ahead.

import { CAR, LANE_OFFSET, ROAD_HALF } from './config.js';
import { ROADS } from './city.js';

export const CAR_TYPES = {
  sedan: { color: '#c94f43', max: 560, accel: 500 },
  taxi: { color: '#f2c94c', max: 580, accel: 520 },
  sports: { color: '#e83e8c', max: 720, accel: 640 },
  truck: { color: '#7a8a99', max: 460, accel: 380 },
  van: { color: '#5da24a', max: 500, accel: 420 },
  police: { color: '#2b6cb0', max: 660, accel: 600 },
};

const TRAFFIC_COLORS = ['sedan', 'taxi', 'sports', 'truck', 'van'];

export function createCar(x, y, angle, type, driver) {
  const spec = CAR_TYPES[type] || CAR_TYPES.sedan;
  return {
    x, y, angle, speed: 0, hp: CAR.hp,
    type, color: spec.color, max: spec.max, accel: spec.accel,
    driver: driver || 'traffic',
    steer: 0, wrecked: false, smoke: 0, hurtCooldown: 0,
    // Traffic state: which way it is turning at the next crossing, if any.
    turnTarget: null, turnCooldown: 0, honk: 0,
  };
}

/** The nearest crossing of two road centrelines ahead of the car, within `ahead` units. */
function crossingAhead(car, ahead) {
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  let best = null;
  let bestD = ahead;
  for (let i = 0; i < ROADS.length; i += 1) {
    for (let j = 0; j < ROADS.length; j += 1) {
      const dx = ROADS[i] - car.x;
      const dy = ROADS[j] - car.y;
      const along = dx * fx + dy * fy;
      if (along < 10 || along > bestD) continue;
      const side = Math.abs(-dx * fy + dy * fx);
      if (side > ROAD_HALF) continue;
      bestD = along;
      best = { x: ROADS[i], y: ROADS[j], along };
    }
  }
  return best;
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** One traffic step: follow the road, decide turns at crossings, slow for traffic ahead. */
function stepTraffic(car, dt, city, cars, random) {
  if (car.wrecked) return;
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);

  // Slow down for a car ahead in the same lane.
  let target = car.max * (0.45 + random() * 0.1);
  for (let i = 0; i < cars.length; i += 1) {
    const other = cars[i];
    if (other === car || other.wrecked) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const along = dx * fx + dy * fy;
    const side = Math.abs(-dx * fy + dy * fx);
    if (along > 0 && along < 110 && side < 40) {
      target = Math.min(target, other.speed * 0.8 + 20);
      if (along < 60 && random() < 0.01) car.honk = 0.4;
    }
  }
  if (car.honk > 0) car.honk -= dt;

  // At a crossing, sometimes turn left or right instead of going straight.
  if (car.turnTarget === null) {
    const crossing = crossingAhead(car, 60);
    if (crossing && car.turnCooldown <= 0) {
      const roll = random();
      const turn = roll < 0.2 ? -Math.PI / 2 : roll < 0.4 ? Math.PI / 2 : 0;
      if (turn !== 0) {
        car.turnTarget = car.angle + turn;
        car.turnCooldown = 2.5;
      } else {
        car.turnCooldown = 1.2;
      }
    }
  }
  if (car.turnCooldown > 0) car.turnCooldown -= dt;

  if (car.turnTarget !== null) {
    const diff = angleDiff(car.turnTarget, car.angle);
    const step = Math.max(-CAR.turnRate * dt, Math.min(CAR.turnRate * dt, diff));
    car.angle += step;
    if (Math.abs(diff) < 0.05) {
      car.angle = car.turnTarget;
      car.turnTarget = null;
      // Settle onto the lane of the new road.
      const snapped = city.nearestRoadPoint(car.x, car.y);
      car.x = snapped.x;
      car.y = snapped.y;
    }
  }

  car.speed += (target - car.speed) * Math.min(1, dt * 1.5);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  // The city ends at the sea and the boardwalk: never drive off the map.
  if (car.x < 40 || car.x > 3560 || car.y < 40 || car.y > 3560) {
    car.x = Math.max(40, Math.min(3560, car.x));
    car.y = Math.max(40, Math.min(3560, car.y));
    car.speed *= 0.4;
  }
  city.collideCircle(car, CAR.radius * 0.8);
}

/**
 * Drive the player's car with the controls: up/down for throttle, left/right to steer,
 * brake for the handbrake. Returns true when it hit something hard this step.
 */
export function driveCar(car, controls, dt, city) {
  if (car.wrecked) return false;
  const throttle = controls.y < 0 ? car.accel : controls.y > 0 ? CAR.reverseAccel : 0;
  const max = controls.y > 0 ? CAR.maxReverse : car.max;
  car.speed += throttle * dt;
  if (controls.y === 0) car.speed -= car.speed * Math.min(1, dt * 1.2);
  if (controls.brake) car.speed -= car.speed * Math.min(1, dt * 6) + Math.sign(car.speed) * CAR.brake * dt * 0.4;
  if (car.speed > max) car.speed = max;
  if (car.speed < -CAR.maxReverse) car.speed = -CAR.maxReverse;
  if (Math.abs(car.speed) < 4 && controls.y === 0) car.speed = 0;

  const steerInput = controls.x || 0;
  const steerAuthority = Math.min(1, Math.abs(car.speed) / 160);
  car.angle += steerInput * CAR.turnRate * steerAuthority * Math.sign(car.speed || 1) * dt;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  // The city ends at the sea and the boardwalk: never drive off the map.
  if (car.x < 40 || car.x > 3560 || car.y < 40 || car.y > 3560) {
    car.x = Math.max(40, Math.min(3560, car.x));
    car.y = Math.max(40, Math.min(3560, car.y));
    car.speed *= 0.5;
  }
  const hit = city.collideCircle(car, CAR.radius * 0.8);
  if (hit && Math.abs(car.speed) > 240) {
    car.speed *= 0.55;
    if (car.hurtCooldown <= 0) {
      car.hp -= 8;
      car.hurtCooldown = 0.6;
    }
    if (car.hp <= 0) {
      car.wrecked = true;
      car.speed = 0;
    }
    return true;
  }
  if (hit) car.speed *= 0.9;
  return false;
}

/** Push two cars apart and trade a little speed; returns the impact speed. */
export function collideCars(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy) || 1;
  const min = CAR.radius * 1.6;
  if (d >= min) return 0;
  const push = (min - d) / 2;
  const nx = dx / d;
  const ny = dy / d;
  a.x -= nx * push;
  a.y -= ny * push;
  b.x += nx * push;
  b.y += ny * push;
  const impact = Math.abs(a.speed - b.speed);
  const exchange = impact * 0.25;
  if (a.speed > b.speed) {
    a.speed -= exchange;
    b.speed += exchange * 0.5;
  } else {
    b.speed -= exchange;
    a.speed += exchange * 0.5;
  }
  return impact;
}

/** True when the value sits on a road centreline (225 + 450*k). */
function onRoadLine(value) {
  const rel = ((value - 225) % 450 + 450) % 450;
  return rel < 1 || rel > 449;
}

/** Spawn traffic and parked cars across the city, away from (ax, ay). */
export function spawnCars(city, random, ax, ay) {
  const cars = [];
  for (let i = 0; i < 16; i += 1) {
    const p = city.randomRoadPoint(ax, ay, 500);
    const horizontal = onRoadLine(p.y);
    const angle = horizontal ? (random() < 0.5 ? 0 : Math.PI) : (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    const lane = random() < 0.5 ? -LANE_OFFSET : LANE_OFFSET;
    const car = createCar(
      p.x + (horizontal ? 0 : lane),
      p.y + (horizontal ? lane : 0),
      angle,
      TRAFFIC_COLORS[Math.floor(random() * TRAFFIC_COLORS.length)],
      'traffic',
    );
    car.speed = 200 + random() * 200;
    cars.push(car);
  }
  for (let i = 0; i < 14; i += 1) {
    const p = city.randomRoadPoint(ax, ay, 300);
    const horizontal = onRoadLine(p.y);
    const angle = horizontal ? (random() < 0.5 ? 0 : Math.PI) : (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    const lane = random() < 0.5 ? -1 : 1;
    const car = createCar(
      p.x + (horizontal ? 0 : lane * (ROAD_HALF - 12)),
      p.y + (horizontal ? lane * (ROAD_HALF - 12) : 0),
      angle,
      TRAFFIC_COLORS[Math.floor(random() * TRAFFIC_COLORS.length)],
      'parked',
    );
    cars.push(car);
  }
  return cars;
}

export function stepTrafficCars(cars, dt, city, random) {
  for (let i = 0; i < cars.length; i += 1) {
    const car = cars[i];
    if (car.driver === 'traffic') stepTraffic(car, dt, city, cars, random);
    if (car.wrecked && car.smoke < 1) car.smoke = Math.min(1, car.smoke + dt * 0.2);
  }
}
