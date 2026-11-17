// The player: on foot or behind a wheel. On foot they walk, run, punch and steal cars;
// in a car they are the car. Health, cash and the busted/wasted consequences live here.

import { CAR, PLAYER } from './config.js';

export function createPlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2,
    speed: 0,
    health: PLAYER.health,
    cash: 50,
    car: null,
    punchCooldown: 0,
    punchAnim: 0,
    hurtFlash: 0,
    invulnerable: 0,
  };
}

/** The nearest stealable car within reach, or null. */
export function nearestCar(player, cars) {
  let best = null;
  let bestD = 80 * 80;
  for (let i = 0; i < cars.length; i += 1) {
    const car = cars[i];
    if (car.driver === 'player' || car.driver === 'police' || car.wrecked) continue;
    const dx = car.x - player.x;
    const dy = car.y - player.y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

export function enterCar(player, car) {
  player.car = car;
  car.driver = 'player';
  car.speed = 0;
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
}

export function exitCar(player) {
  const car = player.car;
  if (!car) return;
  car.driver = 'parked';
  car.speed = 0;
  const side = Math.cos(car.angle + Math.PI / 2);
  const sideY = Math.sin(car.angle + Math.PI / 2);
  player.x = car.x + side * 46;
  player.y = car.y + sideY * 46;
  player.angle = car.angle;
  player.car = null;
}

export function damagePlayer(player, amount) {
  if (player.invulnerable > 0) return;
  player.health = Math.max(0, player.health - amount);
  player.hurtFlash = 0.4;
  player.invulnerable = 0.5;
}

/** One on-foot step. Returns 'punched' when a punch lands this step. */
export function stepOnFoot(player, controls, dt, city, peds) {
  if (player.punchCooldown > 0) player.punchCooldown -= dt;
  if (player.punchAnim > 0) player.punchAnim -= dt;
  if (player.hurtFlash > 0) player.hurtFlash -= dt;
  if (player.invulnerable > 0) player.invulnerable -= dt;

  const mx = controls.x || 0;
  const my = controls.y || 0;
  const moving = mx !== 0 || my !== 0;
  const speed = controls.sprint ? PLAYER.runSpeed : PLAYER.walkSpeed;
  if (moving) {
    const len = Math.hypot(mx, my) || 1;
    player.x += (mx / len) * speed * dt;
    player.y += (my / len) * speed * dt;
    player.angle = Math.atan2(my / len, mx / len);
    player.speed = speed;
  } else {
    player.speed = 0;
  }
  city.collideCircle(player, PLAYER.radius);
  player.x = Math.max(40, Math.min(3560, player.x));
  player.y = Math.max(40, Math.min(3560, player.y));

  if (player.health > 0 && player.health < PLAYER.health) player.health = Math.min(PLAYER.health, player.health + dt * 1.5);

  if (controls.punch && player.punchCooldown <= 0) {
    player.punchCooldown = PLAYER.punchCooldown;
    player.punchAnim = 0.22;
    const px = player.x + Math.cos(player.angle) * PLAYER.punchRange * 0.7;
    const py = player.y + Math.sin(player.angle) * PLAYER.punchRange * 0.7;
    for (let i = 0; i < peds.length; i += 1) {
      const ped = peds[i];
      if (ped.state === 'down') continue;
      const dx = ped.x - px;
      const dy = ped.y - py;
      if (dx * dx + dy * dy < PLAYER.punchRange * PLAYER.punchRange) {
        ped.state = 'down';
        ped.stateTime = 3;
        return 'punched';
      }
    }
  }
  return null;
}

/** Keep the player's position glued to the car they drive. */
export function syncToCar(player) {
  if (!player.car) return;
  player.x = player.car.x;
  player.y = player.car.y;
  player.angle = player.car.angle;
  player.speed = player.car.speed;
}

export function respawn(player, x, y) {
  if (player.car) exitCar(player);
  player.x = x;
  player.y = y;
  player.health = PLAYER.health;
  player.invulnerable = 1;
  player.hurtFlash = 0;
}
