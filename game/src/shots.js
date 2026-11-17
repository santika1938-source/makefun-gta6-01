// The screenshot scenes behind ?shot=start|drive|chase|mission. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a simple
// autopilot (drive along the road ahead, hold the throttle), so the frame is what a
// short game really looks like — and the same seed always gives the same frame.

import { STEP } from './config.js';
import { addWanted } from './police.js';
import { enterCar } from './player.js';
import { CAR_TYPES, createCar } from './vehicles.js';
import { startMission } from './missions.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 3;
const DRIVE_SECONDS = 2.2;
const CHASE_SECONDS = 3;
const MISSION_SECONDS = 2.2;

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Steer the player's car at a point 200 units ahead, snapped to the road grid. */
function autopilotControls(world) {
  const car = world.state.player.car;
  if (!car) return { x: 0, y: 0, sprint: false, brake: false, enter: false, punch: false };
  const aheadX = car.x + Math.cos(car.angle) * 200;
  const aheadY = car.y + Math.sin(car.angle) * 200;
  const point = world.state.city.nearestRoadPoint(aheadX, aheadY);
  const want = Math.atan2(point.y - car.y, point.x - car.x);
  const diff = angleDiff(want, car.angle);
  return {
    x: Math.max(-1, Math.min(1, diff * 2)),
    y: -1,
    sprint: false,
    brake: false,
    enter: false,
    punch: false,
  };
}

function driveFor(world, seconds, audio) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    world.step(STEP, autopilotControls(world), audio || null);
  }
}

function idleFor(world, seconds) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    world.step(STEP, { x: 0, y: 0, sprint: false, brake: false, enter: false, punch: false }, null);
  }
}

/** Put the player in a car of `type` at (x, y) facing `angle`, ready to drive. */
function putPlayerInCar(world, x, y, angle, type) {
  const state = world.state;
  const car = state.cars[state.cars.length - 1];
  car.type = type || 'sports';
  car.color = (CAR_TYPES[car.type] || CAR_TYPES.sports).color;
  car.max = (CAR_TYPES[car.type] || CAR_TYPES.sports).max;
  car.accel = (CAR_TYPES[car.type] || CAR_TYPES.sports).accel;
  car.x = x;
  car.y = y;
  car.angle = angle;
  car.driver = 'parked';
  car.speed = 0;
  state.player.x = x;
  state.player.y = y;
  enterCar(state.player, car);
  return car;
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * start: the title over the garage at dusk. drive: cruising with traffic.
 * chase: three stars, cruisers closing in. mission: the Sunset Delivery run.
 */
export function stageShot(name, world) {
  world.reset();
  const state = world.state;
  if (name === 'drive') {
    putPlayerInCar(world, 675, 651, 0, 'sports');
    // Traffic ahead on the same road, so the frame shows the city moving.
    for (let i = 0; i < 2; i += 1) {
      const car = state.cars[i];
      car.x = 675 + 320 + i * 260;
      car.y = 675 - 24;
      car.angle = 0;
      car.driver = 'traffic';
      car.speed = 260;
    }
    driveFor(world, DRIVE_SECONDS);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'chase') {
    putPlayerInCar(world, 1125, 1551, 0, 'sports');
    addWanted(state.police, 3);
    // One cruiser right on the player's tail, so the chase is in the frame.
    const cruiser = createCar(1125 - 220, 1551 + 24, 0, 'police', 'police');
    cruiser.speed = 500;
    state.cars.push(cruiser);
    state.police.cars.push(cruiser);
    driveFor(world, CHASE_SECONDS);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'mission') {
    startMission(state.missions, 1);
    state.missions.stepIndex = 1;
    state.missions.timer = 96;
    state.missions.dialogue = { speaker: 'Mara', text: 'Package secured. Now the hotel — 100 seconds, and mind the traffic.' };
    state.missions.dialogueTime = 6;
    putPlayerInCar(world, 1800, 2901, 0, 'taxi');
    driveFor(world, MISSION_SECONDS);
    return { screen: SCREEN_PLAY };
  }
  // start (and any other name): the title screen over the garage, the city alive behind it.
  idleFor(world, START_SECONDS);
  return { screen: SCREEN_TITLE };
}
