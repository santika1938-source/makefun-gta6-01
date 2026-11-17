// Every tuning number and colour for Solmar Bay, in one place. The city is a fixed
// 3600x3600 world; the camera follows the player, so no rule below depends on the screen size.

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The city is a square this many world units across. */
export const WORLD_SIZE = 3600;
/** Roads run every this many units, their centrelines at 225 + 450*i. */
export const ROAD_EVERY = 450;
export const ROAD_FIRST = 225;
/** Half a road's width; the lane offset for traffic is a little inside this. */
export const ROAD_HALF = 48;
export const LANE_OFFSET = 24;
/** The beach strip along the south edge, and the water past it. */
export const BEACH_Y = 3423;
export const WATER_Y = 3520;

export const PLAYER = {
  radius: 14,
  walkSpeed: 250,
  runSpeed: 380,
  health: 100,
  punchRange: 46,
  punchDamage: 34,
  punchCooldown: 0.45,
};

export const CAR = {
  length: 64,
  width: 30,
  radius: 30,
  accel: 520,
  brake: 900,
  reverseAccel: 300,
  maxForward: 620,
  maxReverse: 220,
  turnRate: 2.6,
  grip: 0.94,
  hp: 100,
};

export const POLICE = {
  maxCars: 5,
  chaseSpeed: 640,
  ramDamage: 6,
  bustDistance: 84,
  bustTime: 1.2,
  decayDelay: 15,
  decayStep: 5,
};

export const PED = {
  count: 42,
  radius: 11,
  walkSpeed: 55,
  fleeSpeed: 210,
};

export const TRAFFIC_COUNT = 16;
export const PARKED_COUNT = 14;

export const START_CASH = 50;
export const BUSTED_FINE = 100;
export const WASTED_FINE = 100;

export const PALETTE = {
  backdrop: '#101820',
  grass: '#7fae62',
  grassDark: '#74a158',
  sand: '#e8cf96',
  water: '#2e7f9e',
  waterDeep: '#256b87',
  road: '#3a3f47',
  roadEdge: '#2c3038',
  lane: '#d8c95a',
  sidewalk: '#9aa0a8',
  building: ['#c96f4a', '#d8a24a', '#7fa3b8', '#b87f9e', '#8fae7f', '#c9b18a', '#9a7fc9', '#e0e0d8'],
  roof: ['#8a4a30', '#a87c2e', '#5d7f92', '#8a5a72', '#6a8a5d', '#a8906a', '#755a9e', '#b8b8ae'],
  park: '#5d8f4a',
  tree: '#3f7a34',
  treeLight: '#5da24a',
  player: '#ffd23f',
  playerDark: '#c79a12',
  pedShirt: ['#e5534b', '#4fc3f7', '#f2c94c', '#9b7ede', '#7ee081', '#f28bb1', '#f2f2f2', '#ff8c42'],
  text: '#f4f1e6',
  muted: '#b8b2a0',
  panel: 'rgba(16, 22, 30, 0.88)',
  gold: '#f2c94c',
  police: '#2b6cb0',
  policeLight: '#e8eef5',
  wanted: '#ff5252',
  marker: '#ffd23f',
  mission: '#ff9f1c',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the save (cash, missions, best) is kept between visits (this browser only). */
export const SAVE_KEY = 'solmar-bay.save.v1';
