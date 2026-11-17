// The HUD: cash and health top-left, wanted stars top-centre, a live minimap
// top-right, the mission objective and Mara's dialogue at the bottom, and the speed
// when driving. All of it is canvas text and shapes, drawn in screen space.

import { FONT, PALETTE, WORLD_SIZE } from './config.js';
import { ROADS } from './city.js';
import { currentStep, objectiveText } from './missions.js';

const MAP_SIZE = 176;
const MAP_PAD = 14;

export function drawHud(context, view, state) {
  const { width, height } = view;
  const player = state.player;
  const police = state.police;
  context.save();
  context.textBaseline = 'top';

  // --- Top-left: cash and health. ---
  context.fillStyle = PALETTE.panel;
  roundRect(context, 12, 12, 210, 64, 10);
  context.fill();
  context.font = `bold 26px ${FONT}`;
  context.fillStyle = PALETTE.gold;
  context.textAlign = 'left';
  context.fillText(`$${Math.floor(player.cash)}`, 26, 20);
  context.font = `14px ${FONT}`;
  context.fillStyle = PALETTE.muted;
  context.fillText(`Missions ${state.missions.done}/4`, 26, 52);
  // Health bar.
  context.fillStyle = '#222';
  context.fillRect(120, 26, 86, 16);
  context.fillStyle = player.health > 40 ? '#5da24a' : '#e5534b';
  context.fillRect(120, 26, 86 * Math.max(0, player.health / 100), 16);
  context.fillStyle = PALETTE.text;
  context.font = `11px ${FONT}`;
  context.fillText('HP', 100, 28);

  // --- Top-centre: wanted stars. ---
  const stars = police.wanted;
  context.font = `30px ${FONT}`;
  context.textAlign = 'center';
  for (let i = 0; i < 5; i += 1) {
    const x = width / 2 + (i - 2) * 36;
    context.fillStyle = i < stars ? PALETTE.wanted : 'rgba(244,241,230,0.25)';
    context.fillText('★', x, 14);
  }
  if (police.bustProgress > 0) {
    context.font = `bold 15px ${FONT}`;
    context.fillStyle = '#ff8a80';
    context.fillText('THEY ARE ON YOU — RUN!', width / 2, 52);
  }

  drawMinimap(context, view, state);

  // --- Bottom-left: speed and car health while driving. ---
  if (player.car) {
    const car = player.car;
    context.fillStyle = PALETTE.panel;
    roundRect(context, 12, height - 76, 190, 64, 10);
    context.fill();
    context.font = `bold 30px ${FONT}`;
    context.fillStyle = PALETTE.text;
    context.textAlign = 'left';
    context.fillText(`${Math.round(Math.abs(car.speed) * 0.18)} mph`, 26, height - 68);
    context.font = `13px ${FONT}`;
    context.fillStyle = PALETTE.muted;
    context.fillText(car.wrecked ? 'WRECKED — press E to leave' : `Car ${Math.max(0, Math.round(car.hp))}%`, 26, height - 34);
  } else {
    context.font = `13px ${FONT}`;
    context.fillStyle = PALETTE.muted;
    context.textAlign = 'left';
    context.fillText('WASD move · Shift run · E steal car · Space punch · P pause · M mute', 16, height - 24);
  }

  // --- Bottom-centre: mission objective. ---
  const objective = objectiveText(state.missions);
  context.font = `bold 16px ${FONT}`;
  const objW = context.measureText(objective).width;
  context.fillStyle = PALETTE.panel;
  roundRect(context, width / 2 - objW / 2 - 16, height - 108, objW + 32, 34, 10);
  context.fill();
  context.fillStyle = PALETTE.mission;
  context.textAlign = 'center';
  context.fillText(objective, width / 2, height - 99);

  // --- Dialogue line from Mara, above the objective. ---
  const dialogue = state.missions.dialogue;
  if (dialogue) {
    context.font = `15px ${FONT}`;
    const line = `${dialogue.speaker}: ${dialogue.text}`;
    const lineW = Math.min(width - 60, context.measureText(line).width);
    context.fillStyle = 'rgba(16, 22, 30, 0.92)';
    roundRect(context, width / 2 - lineW / 2 - 16, height - 156, lineW + 32, 40, 10);
    context.fill();
    context.fillStyle = PALETTE.text;
    context.fillText(line, width / 2, height - 145);
  }

  // --- Toast messages (mission complete, busted, ...), top-centre below the stars. ---
  if (state.toast && state.toastTime > 0) {
    context.font = `bold 17px ${FONT}`;
    const toastW = context.measureText(state.toast).width;
    context.fillStyle = 'rgba(242, 201, 76, 0.95)';
    roundRect(context, width / 2 - toastW / 2 - 14, 76, toastW + 28, 32, 10);
    context.fill();
    context.fillStyle = '#101820';
    context.fillText(state.toast, width / 2, 83);
  }

  context.restore();
}

function roundRect(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

function drawMinimap(context, view, state) {
  const { width } = view;
  const x0 = width - MAP_SIZE - MAP_PAD;
  const y0 = MAP_PAD;
  const scale = MAP_SIZE / WORLD_SIZE;
  context.fillStyle = 'rgba(16, 22, 30, 0.85)';
  roundRect(context, x0 - 6, y0 - 6, MAP_SIZE + 12, MAP_SIZE + 12, 10);
  context.fill();

  // Grass, beach and water.
  context.fillStyle = '#5d8f4a';
  context.fillRect(x0, y0, MAP_SIZE, MAP_SIZE);
  context.fillStyle = '#e8cf96';
  context.fillRect(x0, y0 + (3423 * scale), MAP_SIZE, MAP_SIZE - 3423 * scale);
  context.fillStyle = '#2e7f9e';
  context.fillRect(x0, y0 + (3520 * scale), MAP_SIZE, MAP_SIZE - 3520 * scale);

  // Roads.
  context.fillStyle = '#3a3f47';
  for (let i = 0; i < ROADS.length; i += 1) {
    context.fillRect(x0, y0 + ROADS[i] * scale - 2, MAP_SIZE, 4);
    context.fillRect(x0 + ROADS[i] * scale - 2, y0, 4, MAP_SIZE);
  }

  // Buildings.
  context.fillStyle = 'rgba(240, 235, 220, 0.55)';
  for (let i = 0; i < state.city.buildings.length; i += 1) {
    const b = state.city.buildings[i];
    context.fillRect(x0 + b.x * scale, y0 + b.y * scale, Math.max(1, b.w * scale), Math.max(1, b.h * scale));
  }

  // Mission target: a pulsing yellow ring.
  const step = currentStep(state.missions);
  if (step && step.target) {
    const pulse = 3 + Math.sin(state.time * 5) * 1.5;
    context.strokeStyle = PALETTE.marker;
    context.lineWidth = 2;
    context.beginPath();
    context.arc(x0 + step.target.x * scale, y0 + step.target.y * scale, pulse + 3, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = PALETTE.marker;
    context.beginPath();
    context.arc(x0 + step.target.x * scale, y0 + step.target.y * scale, 2.5, 0, Math.PI * 2);
    context.fill();
  }

  // Police cars as red dots, the player's car as a white dot.
  context.fillStyle = '#ff5252';
  for (let i = 0; i < state.police.cars.length; i += 1) {
    const car = state.police.cars[i];
    context.fillRect(x0 + car.x * scale - 2, y0 + car.y * scale - 2, 4, 4);
  }
  context.fillStyle = '#ffffff';
  for (let i = 0; i < state.cars.length; i += 1) {
    const car = state.cars[i];
    if (car.driver !== 'player') continue;
    context.fillRect(x0 + car.x * scale - 2, y0 + car.y * scale - 2, 4, 4);
  }

  // The player: a yellow arrow pointing where they face.
  const px = x0 + state.player.x * scale;
  const py = y0 + state.player.y * scale;
  const angle = state.player.angle;
  context.fillStyle = PALETTE.player;
  context.beginPath();
  context.moveTo(px + Math.cos(angle) * 7, py + Math.sin(angle) * 7);
  context.lineTo(px + Math.cos(angle + 2.5) * 5, py + Math.sin(angle + 2.5) * 5);
  context.lineTo(px + Math.cos(angle - 2.5) * 5, py + Math.sin(angle - 2.5) * 5);
  context.closePath();
  context.fill();
}
