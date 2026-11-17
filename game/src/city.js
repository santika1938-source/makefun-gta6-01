// Solmar Bay itself: a procedural coastal city on a road grid. The roads are fixed
// centrelines every 450 units; the blocks between them hold buildings, parks and trees;
// the south edge is a beach and the sea. Nothing here draws or moves: it only builds the
// static layout and answers collision and placement questions for the rest of the game.

import { BEACH_Y, PALETTE, ROAD_EVERY, ROAD_FIRST, ROAD_HALF, WATER_Y, WORLD_SIZE } from './config.js';

/** The road centrelines, one array each way: 225, 675, ..., 3375. */
export const ROADS = [];
for (let i = 0; i < 8; i += 1) ROADS.push(ROAD_FIRST + ROAD_EVERY * i);

/** Named places. `door` is the point on the road edge the missions aim at. */
export const LOCATIONS = {
  garage: { name: "Mara's Garage", x: 900, y: 723, label: 'Garage' },
  paint: { name: 'Sunset Paint Shop', x: 2700, y: 723, label: 'Paint Shop' },
  docks: { name: 'Harbor Docks', x: 900, y: 2973, label: 'Docks' },
  hotel: { name: 'Hotel Solmar', x: 2973, y: 1350, label: 'Hotel' },
  casino: { name: 'Coral Casino', x: 2700, y: 2523, label: 'Casino' },
  safehouse: { name: 'Safehouse', x: 900, y: 1623, label: 'Safehouse' },
  hospital: { name: 'St. Marina Hospital', x: 1800, y: 723, label: 'Hospital' },
  policeHq: { name: 'Bay PD HQ', x: 1800, y: 2523, label: 'Bay PD' },
};

/** The block a point sits in, or -1 when it is on a road or outside the grid. */
function blockIndex(value) {
  if (value < ROAD_FIRST + ROAD_HALF || value > ROADS[7] - ROAD_HALF) return -1;
  const rel = value - (ROAD_FIRST + ROAD_HALF);
  const index = Math.floor(rel / ROAD_EVERY);
  const inside = rel - index * ROAD_EVERY;
  if (inside > ROAD_EVERY - 2 * ROAD_HALF) return -1;
  return index;
}

export function isOnRoad(x, y) {
  for (let i = 0; i < ROADS.length; i += 1) {
    if (Math.abs(x - ROADS[i]) <= ROAD_HALF || Math.abs(y - ROADS[i]) <= ROAD_HALF) return true;
  }
  return false;
}

/** The nearest point on a road centreline to (x, y). */
export function nearestRoadPoint(x, y) {
  let bestX = ROADS[0];
  let bestY = ROADS[0];
  let bestD = Infinity;
  for (let i = 0; i < ROADS.length; i += 1) {
    for (let j = 0; j < ROADS.length; j += 1) {
      const dx = x - ROADS[i];
      const dy = y - ROADS[j];
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        bestX = ROADS[i];
        bestY = ROADS[j];
      }
    }
  }
  // Snap to the nearer of the two roads through that crossing.
  const onVertical = Math.abs(x - bestX) < Math.abs(y - bestY);
  return onVertical ? { x: bestX, y } : { x, y: bestY };
}

export function createCity(random) {
  const buildings = [];
  const trees = [];
  const parks = [];
  const palette = PALETTE.building;
  const roofs = PALETTE.roof;

  // 7x7 blocks. A block is either buildings, a park, or a plaza.
  for (let bx = 0; bx < 7; bx += 1) {
    for (let by = 0; by < 7; by += 1) {
      const x0 = ROAD_FIRST + ROAD_HALF + bx * ROAD_EVERY;
      const y0 = ROAD_FIRST + ROAD_HALF + by * ROAD_EVERY;
      const w = ROAD_EVERY - 2 * ROAD_HALF;
      const roll = random();
      if (roll < 0.14) {
        // A park: grass, a path and a scatter of trees.
        parks.push({ x: x0, y: y0, w, h: w });
        const count = 5 + Math.floor(random() * 5);
        for (let t = 0; t < count; t += 1) {
          trees.push({
            x: x0 + 30 + random() * (w - 60),
            y: y0 + 30 + random() * (w - 60),
            r: 12 + random() * 10,
          });
        }
        continue;
      }
      if (roll < 0.2) {
        // A plaza: open paving with two trees and a fountain block.
        parks.push({ x: x0, y: y0, w, h: w, plaza: true });
        trees.push({ x: x0 + w * 0.25, y: y0 + w * 0.25, r: 16 });
        trees.push({ x: x0 + w * 0.75, y: y0 + w * 0.75, r: 16 });
        buildings.push({
          x: x0 + w / 2 - 26, y: y0 + w / 2 - 26, w: 52, h: 52,
          color: '#7fb8c9', roof: '#5d8fa3', fountain: true,
        });
        continue;
      }
      const colorIndex = Math.floor(random() * palette.length);
      if (random() < 0.45) {
        // One large building filling most of the block.
        const m = 34 + random() * 30;
        buildings.push({
          x: x0 + m, y: y0 + m, w: w - 2 * m, h: w - 2 * m,
          color: palette[colorIndex], roof: roofs[colorIndex],
        });
      } else {
        // Four smaller buildings around a courtyard.
        const half = w / 2;
        for (let q = 0; q < 4; q += 1) {
          const qx = x0 + (q % 2) * half;
          const qy = y0 + Math.floor(q / 2) * half;
          const m = 22 + random() * 18;
          const ci = Math.floor(random() * palette.length);
          buildings.push({
            x: qx + m, y: qy + m, w: half - 2 * m, h: half - 2 * m,
            color: palette[ci], roof: roofs[ci],
          });
        }
      }
      // A street tree or two on the block's corners.
      if (random() < 0.6) {
        trees.push({ x: x0 + 18, y: y0 + 18, r: 12 });
        trees.push({ x: x0 + w - 18, y: y0 + w - 18, r: 12 });
      }
    }
  }

  // The beach boardwalk: a row of palms along the sand.
  for (let x = 200; x < WORLD_SIZE; x += 260) {
    trees.push({ x: x + random() * 60, y: BEACH_Y + 40 + random() * 30, r: 14, palm: true });
  }

  /** Push a circle out of every building it overlaps; returns true when it moved. */
  function collideCircle(body, radius) {
    let moved = false;
    for (let i = 0; i < buildings.length; i += 1) {
      const b = buildings[i];
      if (b.fountain) continue;
      const cx = Math.max(b.x, Math.min(body.x, b.x + b.w));
      const cy = Math.max(b.y, Math.min(body.y, b.y + b.h));
      const dx = body.x - cx;
      const dy = body.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 >= radius * radius) continue;
      if (d2 === 0) {
        body.x = b.x - radius;
        moved = true;
        continue;
      }
      const d = Math.sqrt(d2);
      body.x = cx + (dx / d) * radius;
      body.y = cy + (dy / d) * radius;
      moved = true;
    }
    return moved;
  }

  /** A random point on a road, at least `clear` away from (ax, ay). */
  function randomRoadPoint(ax, ay, clear) {
    for (let tries = 0; tries < 40; tries += 1) {
      const horizontal = random() < 0.5;
      const road = ROADS[Math.floor(random() * ROADS.length)];
      const along = 300 + random() * (WORLD_SIZE - 600);
      const x = horizontal ? along : road;
      const y = horizontal ? road : along;
      const dx = x - ax;
      const dy = y - ay;
      if (dx * dx + dy * dy >= clear * clear) return { x, y };
    }
    return { x: ROADS[3], y: ROADS[3] };
  }

  /** A random point on a sidewalk beside a road. */
  function randomSidewalkPoint() {
    const horizontal = random() < 0.5;
    const road = ROADS[Math.floor(random() * ROADS.length)];
    const along = 300 + random() * (WORLD_SIZE - 600);
    const side = random() < 0.5 ? -1 : 1;
    const off = ROAD_HALF + 16 + random() * 10;
    return horizontal
      ? { x: along, y: road + side * off }
      : { x: road + side * off, y: along };
  }

  return {
    buildings,
    trees,
    parks,
    locations: LOCATIONS,
    blockIndex,
    isOnRoad,
    nearestRoadPoint,
    collideCircle,
    randomRoadPoint,
    randomSidewalkPoint,
    beachY: BEACH_Y,
    waterY: WATER_Y,
    size: WORLD_SIZE,
  };
}
