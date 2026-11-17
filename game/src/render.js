// Drawing only: the world's state and the current screen in, pixels out. The camera
// follows the player across the 3600x3600 city; the ground, roads, buildings, cars,
// pedestrians, markers and particles are painted in world space, then the HUD and the
// screen panels in screen space. Flat colours with shadows and a warm sun-soaked palette.

import { FONT, PALETTE, WORLD_SIZE } from './config.js';
import { LOCATIONS, ROADS } from './city.js';
import { currentStep } from './missions.js';
import { drawHud } from './hud.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';

const CAMERA_LERP = 0.12;

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { width: 1280, height: 720, dpr: 1 };
  const camera = { x: 900, y: 675, zoom: 1 };
  const fonts = new Map();

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    view.dpr = dpr;
    view.width = window.innerWidth;
    view.height = window.innerHeight;
    canvas.width = Math.round(view.width * dpr);
    canvas.height = Math.round(view.height * dpr);
  }

  function text(value, x, y, size, color, align, bold) {
    const key = `${size}:${bold ? 1 : 0}`;
    if (!fonts.has(key)) fonts.set(key, `${bold ? 'bold ' : ''}${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.fillText(value, x, y);
  }

  function roundRectPath(x, y, w, h, r) {
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
  }

  function drawGround(state, vis) {
    context.fillStyle = PALETTE.grass;
    context.fillRect(vis.x0, vis.y0, vis.x1 - vis.x0, vis.y1 - vis.y0);
    // Mow stripes on the grass, for a little texture.
    context.fillStyle = PALETTE.grassDark;
    const stripe = 120;
    for (let y = Math.floor(vis.y0 / stripe) * stripe; y < vis.y1; y += stripe * 2) {
      context.fillRect(vis.x0, y, vis.x1 - vis.x0, stripe);
    }
    // Beach and sea along the south edge.
    if (vis.y1 > state.city.beachY) {
      context.fillStyle = PALETTE.sand;
      context.fillRect(vis.x0, Math.max(vis.y0, state.city.beachY), vis.x1 - vis.x0, vis.y1 - Math.max(vis.y0, state.city.beachY));
    }
    if (vis.y1 > state.city.waterY) {
      context.fillStyle = PALETTE.water;
      context.fillRect(vis.x0, Math.max(vis.y0, state.city.waterY), vis.x1 - vis.x0, vis.y1 - Math.max(vis.y0, state.city.waterY));
      context.strokeStyle = 'rgba(255,255,255,0.35)';
      context.lineWidth = 2;
      for (let y = state.city.waterY + 24; y < vis.y1; y += 48) {
        context.beginPath();
        for (let x = vis.x0; x < vis.x1; x += 40) {
          const yy = y + Math.sin(x * 0.02 + state.time * 2 + y) * 4;
          if (x === vis.x0) context.moveTo(x, yy);
          else context.lineTo(x, yy);
        }
        context.stroke();
      }
    }
  }

  function drawRoads(vis) {
    for (let i = 0; i < ROADS.length; i += 1) {
      const r = ROADS[i];
      // Horizontal road.
      if (r + 48 > vis.y0 && r - 48 < vis.y1) {
        context.fillStyle = PALETTE.road;
        context.fillRect(vis.x0, r - 48, vis.x1 - vis.x0, 96);
        context.fillStyle = PALETTE.roadEdge;
        context.fillRect(vis.x0, r - 48, vis.x1 - vis.x0, 3);
        context.fillRect(vis.x0, r + 45, vis.x1 - vis.x0, 3);
        context.fillStyle = PALETTE.lane;
        for (let x = Math.floor(vis.x0 / 60) * 60; x < vis.x1; x += 60) {
          context.fillRect(x, r - 2, 30, 4);
        }
      }
      // Vertical road.
      if (r + 48 > vis.x0 && r - 48 < vis.x1) {
        context.fillStyle = PALETTE.road;
        context.fillRect(r - 48, vis.y0, 96, vis.y1 - vis.y0);
        context.fillStyle = PALETTE.roadEdge;
        context.fillRect(r - 48, vis.y0, 3, vis.y1 - vis.y0);
        context.fillRect(r + 45, vis.y0, 3, vis.y1 - vis.y0);
        context.fillStyle = PALETTE.lane;
        for (let y = Math.floor(vis.y0 / 60) * 60; y < vis.y1; y += 60) {
          context.fillRect(r - 2, y, 4, 30);
        }
      }
    }
  }

  function drawBlocks(state, vis) {
    const { buildings, parks, trees } = state.city;
    for (let i = 0; i < parks.length; i += 1) {
      const p = parks[i];
      if (p.x > vis.x1 || p.x + p.w < vis.x0 || p.y > vis.y1 || p.y + p.h < vis.y0) continue;
      context.fillStyle = p.plaza ? '#b9b3a4' : PALETTE.park;
      context.fillRect(p.x, p.y, p.w, p.h);
    }
    for (let i = 0; i < buildings.length; i += 1) {
      const b = buildings[i];
      if (b.x > vis.x1 || b.x + b.w < vis.x0 || b.y > vis.y1 || b.y + b.h < vis.y0) continue;
      // Shadow, then the body, then a roof inset and a few roof details.
      context.fillStyle = 'rgba(0,0,0,0.22)';
      context.fillRect(b.x + 7, b.y + 9, b.w, b.h);
      context.fillStyle = b.color;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.fillStyle = b.roof;
      context.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
      if (!b.fountain && b.w > 90) {
        context.fillStyle = 'rgba(0,0,0,0.18)';
        const cols = Math.floor((b.w - 30) / 34);
        const rows = Math.floor((b.h - 30) / 34);
        for (let cx = 0; cx < cols; cx += 1) {
          for (let cy = 0; cy < rows; cy += 1) {
            context.fillRect(b.x + 18 + cx * 34, b.y + 18 + cy * 34, 16, 12);
          }
        }
      }
      if (b.fountain) {
        context.fillStyle = '#7fb8c9';
        context.beginPath();
        context.arc(b.x + b.w / 2, b.y + b.h / 2, 16, 0, Math.PI * 2);
        context.fill();
      }
    }
    for (let i = 0; i < trees.length; i += 1) {
      const t = trees[i];
      if (t.x < vis.x0 - 30 || t.x > vis.x1 + 30 || t.y < vis.y0 - 30 || t.y > vis.y1 + 30) continue;
      if (t.palm) {
        context.strokeStyle = '#8a6a42';
        context.lineWidth = 5;
        context.beginPath();
        context.moveTo(t.x, t.y + 8);
        context.lineTo(t.x + 4, t.y - 12);
        context.stroke();
        context.fillStyle = PALETTE.treeLight;
        context.beginPath();
        context.arc(t.x + 4, t.y - 14, t.r, 0, Math.PI * 2);
        context.fill();
      } else {
        context.fillStyle = 'rgba(0,0,0,0.2)';
        context.beginPath();
        context.arc(t.x + 4, t.y + 5, t.r, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = PALETTE.tree;
        context.beginPath();
        context.arc(t.x, t.y, t.r, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = PALETTE.treeLight;
        context.beginPath();
        context.arc(t.x - t.r * 0.25, t.y - t.r * 0.25, t.r * 0.55, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  function drawLocationLabels(vis) {
    context.textBaseline = 'alphabetic';
    for (const key of Object.keys(LOCATIONS)) {
      const loc = LOCATIONS[key];
      if (loc.x < vis.x0 || loc.x > vis.x1 || loc.y < vis.y0 || loc.y > vis.y1) continue;
      text(loc.label, loc.x, loc.y - 56, 13, 'rgba(16,22,30,0.75)', 'center', true);
    }
  }

  function drawMarker(state) {
    const step = currentStep(state.missions);
    if (!step || !step.target) return;
    const pulse = 1 + Math.sin(state.time * 5) * 0.12;
    const { x, y } = step.target;
    // A beam of light the player can follow across the city.
    const grad = context.createLinearGradient(x, y - 260, x, y);
    grad.addColorStop(0, 'rgba(255, 210, 63, 0)');
    grad.addColorStop(1, 'rgba(255, 210, 63, 0.35)');
    context.fillStyle = grad;
    context.fillRect(x - 14, y - 260, 28, 260);
    context.strokeStyle = PALETTE.marker;
    context.lineWidth = 3;
    context.beginPath();
    context.arc(x, y, 34 * pulse, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = PALETTE.marker;
    context.beginPath();
    context.arc(x, y, 7, 0, Math.PI * 2);
    context.fill();
    text(step.target.label || '', x, y - 46, 14, '#101820', 'center', true);
  }

  function drawPickups(state, vis) {
    for (let i = 0; i < state.pickups.length; i += 1) {
      const p = state.pickups[i];
      if (p.x < vis.x0 || p.x > vis.x1 || p.y < vis.y0 || p.y > vis.y1) continue;
      const bob = Math.sin(state.time * 3 + p.bob) * 3;
      if (p.kind === 'cash') {
        context.fillStyle = '#2e9e5b';
        context.beginPath();
        context.arc(p.x, p.y + bob, 13, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#ffffff';
        text('$', p.x, p.y + bob + 5, 15, '#ffffff', 'center', true);
      } else {
        context.fillStyle = '#ffffff';
        context.fillRect(p.x - 11, p.y + bob - 11, 22, 22);
        context.fillStyle = '#e5534b';
        context.fillRect(p.x - 3, p.y + bob - 8, 6, 16);
        context.fillRect(p.x - 8, p.y + bob - 3, 16, 6);
      }
    }
  }

  function drawCar(car, state) {
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    // Shadow.
    context.fillStyle = 'rgba(0,0,0,0.28)';
    context.beginPath();
    context.ellipse(3, 5, 34, 17, 0, 0, Math.PI * 2);
    context.fill();
    // Wheels.
    context.fillStyle = '#16181c';
    context.fillRect(-24, -17, 12, 6);
    context.fillRect(12, -17, 12, 6);
    context.fillRect(-24, 11, 12, 6);
    context.fillRect(12, 11, 12, 6);
    // Body.
    context.fillStyle = car.wrecked ? '#4a4a4a' : car.color;
    roundRectPath(-32, -15, 64, 30, 8);
    context.fill();
    // Roof and windshield.
    context.fillStyle = car.wrecked ? '#3a3a3a' : 'rgba(20,30,40,0.55)';
    context.fillRect(-12, -11, 22, 22);
    context.fillStyle = 'rgba(255,255,255,0.35)';
    context.fillRect(8, -11, 5, 22);
    if (car.type === 'taxi') {
      context.fillStyle = '#101820';
      for (let x = -26; x < 26; x += 12) context.fillRect(x, -15, 6, 4);
    }
    if (car.type === 'truck') {
      context.fillStyle = 'rgba(0,0,0,0.25)';
      context.fillRect(-30, -12, 26, 24);
    }
    if (car.type === 'sports') {
      context.fillStyle = 'rgba(0,0,0,0.4)';
      context.fillRect(-32, -13, 5, 26);
    }
    if (car.driver === 'police') {
      context.fillStyle = PALETTE.policeLight;
      context.fillRect(-6, -15, 14, 30);
      // Flashing light bar.
      const flash = Math.floor(state.time * 4) % 2 === 0;
      context.fillStyle = flash ? '#ff2d2d' : '#2d7dff';
      context.beginPath();
      context.arc(-2, -15, 5, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = flash ? '#2d7dff' : '#ff2d2d';
      context.beginPath();
      context.arc(-2, 15, 5, 0, Math.PI * 2);
      context.fill();
    }
    // Headlights.
    context.fillStyle = 'rgba(255, 244, 180, 0.9)';
    context.fillRect(30, -11, 3, 5);
    context.fillRect(30, 6, 3, 5);
    context.restore();
  }

  function drawPed(ped) {
    const down = ped.state === 'down';
    context.save();
    context.translate(ped.x, ped.y);
    if (down) {
      context.rotate(Math.PI / 2);
      context.fillStyle = ped.shirt;
      context.beginPath();
      context.ellipse(0, 0, 14, 7, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#e8b98a';
      context.beginPath();
      context.arc(16, 0, 6, 0, Math.PI * 2);
      context.fill();
      context.restore();
      return;
    }
    context.fillStyle = 'rgba(0,0,0,0.25)';
    context.beginPath();
    context.ellipse(2, 4, 10, 6, 0, 0, Math.PI * 2);
    context.fill();
    const swing = Math.sin(ped.legPhase) * 4;
    context.strokeStyle = '#2c3038';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(0, 4);
    context.lineTo(swing, 12);
    context.moveTo(0, 4);
    context.lineTo(-swing, 12);
    context.stroke();
    context.fillStyle = ped.shirt;
    context.beginPath();
    context.arc(0, 0, 9, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#e8b98a';
    context.beginPath();
    context.arc(0, -4, 6, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawPlayer(state) {
    const player = state.player;
    if (player.car) return; // The car is drawn; the driver is inside it.
    context.save();
    context.translate(player.x, player.y);
    const blink = player.hurtFlash > 0 && Math.floor(player.hurtFlash * 12) % 2 === 0;
    context.fillStyle = 'rgba(0,0,0,0.3)';
    context.beginPath();
    context.ellipse(2, 5, 13, 8, 0, 0, Math.PI * 2);
    context.fill();
    if (!blink) {
      const swing = Math.sin(state.time * 10) * (player.speed > 0 ? 4 : 0);
      context.strokeStyle = '#22262e';
      context.lineWidth = 4;
      context.beginPath();
      context.moveTo(0, 4);
      context.lineTo(swing, 14);
      context.moveTo(0, 4);
      context.lineTo(-swing, 14);
      context.stroke();
      context.fillStyle = PALETTE.player;
      context.beginPath();
      context.arc(0, 0, 13, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = PALETTE.playerDark;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(0, 0, 13, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = '#e8b98a';
      context.beginPath();
      context.arc(0, -3, 7, 0, Math.PI * 2);
      context.fill();
      // Facing tick.
      context.strokeStyle = '#101820';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(Math.cos(player.angle) * 10, Math.sin(player.angle) * 10);
      context.lineTo(Math.cos(player.angle) * 18, Math.sin(player.angle) * 18);
      context.stroke();
      // Punch.
      if (player.punchAnim > 0) {
        context.fillStyle = '#ffffff';
        context.beginPath();
        context.arc(Math.cos(player.angle) * 30, Math.sin(player.angle) * 30, 8, 0, Math.PI * 2);
        context.fill();
      }
    }
    context.restore();
  }

  function drawParticles(state) {
    for (let i = 0; i < state.particles.length; i += 1) {
      const p = state.particles[i];
      context.globalAlpha = Math.max(0, p.life / p.maxLife);
      context.fillStyle = p.color;
      context.beginPath();
      context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function drawPanel(title, lines, prompt) {
    const width = 640;
    const height = 150 + lines.length * 34;
    const x = (view.width - width) / 2;
    const y = (view.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    roundRectPath(x, y, width, height, 14);
    context.fill();
    context.textBaseline = 'alphabetic';
    text(title, view.width / 2, y + 66, 44, PALETTE.text, 'center', true);
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], view.width / 2, y + 116 + i * 34, 19, PALETTE.muted, 'center');
    }
    text(prompt, view.width / 2, y + height - 26, 20, PALETTE.gold, 'center', true);
  }

  /** Paint one frame: the world through the camera, then the HUD and the screen panel. */
  function draw(state, screen, meta) {
    const player = state.player;
    // Follow the player, snapping when the jump is large (a fresh scene, a respawn)
    // so the first painted frame already has them in view.
    const dx = player.x - camera.x;
    const dy = player.y - camera.y;
    if (Math.abs(dx) > 400 || Math.abs(dy) > 400) {
      camera.x = player.x;
      camera.y = player.y;
    } else {
      camera.x += dx * CAMERA_LERP;
      camera.y += dy * CAMERA_LERP;
    }
    const halfW = view.width / 2 / camera.zoom;
    const halfH = view.height / 2 / camera.zoom;
    camera.x = Math.max(halfW, Math.min(WORLD_SIZE - halfW, camera.x));
    camera.y = Math.max(halfH, Math.min(WORLD_SIZE - halfH, camera.y));
    const vis = {
      x0: camera.x - halfW - 40,
      y0: camera.y - halfH - 40,
      x1: camera.x + halfW + 40,
      y1: camera.y + halfH + 40,
    };

    context.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, view.width, view.height);
    context.save();
    context.translate(view.width / 2, view.height / 2);
    context.scale(camera.zoom, camera.zoom);
    context.translate(-camera.x, -camera.y);

    drawGround(state, vis);
    drawRoads(vis);
    drawBlocks(state, vis);
    drawLocationLabels(vis);
    drawMarker(state);
    drawPickups(state, vis);
    for (let i = 0; i < state.cars.length; i += 1) drawCar(state.cars[i], state);
    for (let i = 0; i < state.peds.length; i += 1) {
      const ped = state.peds[i];
      if (ped.x < vis.x0 || ped.x > vis.x1 || ped.y < vis.y0 || ped.y > vis.y1) continue;
      drawPed(ped);
    }
    drawPlayer(state);
    drawParticles(state);
    context.restore();

    if (screen === SCREEN_TITLE) {
      context.fillStyle = 'rgba(10, 16, 24, 0.55)';
      context.fillRect(0, 0, view.width, view.height);
      drawPanel(
        'SOLMAR BAY',
        [
          'An open-city crime story. Steal cars, outrun the Bay PD,',
          'and finish Mara Voss\u2019s four jobs — from the garage to the Coral Casino.',
          '',
          'WASD drive & walk · E steal a car · Space punch / handbrake',
          'Shift run · N start the next job · P pause · M mute',
          meta && meta.done > 0 ? `Save loaded: $${meta.cash} · ${meta.done}/4 missions done` : 'A fresh start in the bay — $50 in your pocket',
        ],
        'Press Space or click to start',
      );
      return;
    }
    drawHud(context, view, state);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The city waits for you.'], 'Press P to keep driving');
    } else if (screen === SCREEN_BUSTED) {
      drawPanel('BUSTED!', ['The Bay PD caught you. They took their fine.'], 'Press Space to get back out there');
    } else if (screen === SCREEN_WASTED) {
      drawPanel('WASTED', ['St. Marina patched you up — for a price.'], 'Press Space to get back out there');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, view };
}
