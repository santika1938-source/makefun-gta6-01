// Missions and the story of Solmar Bay. Mara Voss, a fixer who runs the garage on
// Marlin Street, hires the player — a driver fresh out of the bay's back alleys — for
// four jobs that end at the Coral Casino. Each mission is steps with a target on the
// map; the world calls update() every step and reads objective() for the HUD.

import { LOCATIONS } from './city.js';

function gotoStep(target, radius, text, line) {
  return { kind: 'goto', target, radius: radius || 80, text, line: line || null };
}

export const MISSION_DEFS = [
  {
    id: 'wheels-up',
    title: 'Wheels Up',
    reward: 150,
    intro: 'Mara Voss needs a driver. Get to her garage and prove you can handle a car.',
    lines: [
      { speaker: 'Mara', text: 'You must be the new driver. First rule of Solmar Bay: never walk when you can drive.' },
      { speaker: 'Mara', text: 'Borrow a car — any car. The paint shop on Coral Row owes me a favour. Take it there.' },
    ],
    steps: [
      gotoStep(LOCATIONS.garage, 80, 'Go to Mara\'s Garage', { speaker: 'Mara', text: 'Good. You found the garage. Now borrow a car — press E next to one.' }),
      { kind: 'enterCar', target: null, radius: 0, text: 'Steal a car (press E next to one)' },
      gotoStep(LOCATIONS.paint, 90, 'Drive to the Sunset Paint Shop', { speaker: 'Mara', text: 'Nice wheels. The paint shop will make it yours. Job done — $150.' }),
    ],
  },
  {
    id: 'sunset-delivery',
    title: 'Sunset Delivery',
    reward: 300,
    intro: 'A package is waiting at the Harbor Docks. Hotel Solmar wants it before sundown.',
    lines: [
      { speaker: 'Mara', text: 'A crate came in at the docks. Hotel Solmar pays $300 if it arrives in one piece. Fast, not reckless.' },
      { speaker: 'Mara', text: 'Smash into things and the Bay PD will notice. Keep it clean.' },
    ],
    steps: [
      gotoStep(LOCATIONS.docks, 90, 'Pick up the package at the Harbor Docks', { speaker: 'Mara', text: 'Package secured. Now the hotel — 100 seconds, and mind the traffic.' }),
      { kind: 'timed', target: LOCATIONS.hotel, radius: 90, time: 100, text: 'Deliver to Hotel Solmar' },
    ],
  },
  {
    id: 'heat-wave',
    title: 'Heat Wave',
    reward: 450,
    intro: 'The Bay PD is cracking down. Mara set the heat on you on purpose — lose them.',
    lines: [
      { speaker: 'Mara', text: 'The PD thinks you hit the docks last night. Three stars, and they are coming. Lose them.' },
      { speaker: 'Mara', text: 'Break line of sight, then get to the safehouse. Do not get busted.' },
    ],
    steps: [
      { kind: 'survive', target: LOCATIONS.safehouse, radius: 90, time: 75, text: 'Lose the police, then reach the Safehouse' },
    ],
  },
  {
    id: 'coral-heist',
    title: 'The Coral Heist',
    reward: 800,
    intro: 'One last job: the Coral Casino vault. Grab the cash and vanish into the bay.',
    lines: [
      { speaker: 'Mara', text: 'The Coral Casino keeps its weekend take in a vault with a very lazy guard. Tonight it is ours.' },
      { speaker: 'Mara', text: 'Get in on foot, grab the cash, and run. The whole PD will be on you — the safehouse is the only way out.' },
    ],
    steps: [
      gotoStep(LOCATIONS.casino, 90, 'Reach the Coral Casino', { speaker: 'Mara', text: 'You are in. Grab the cash from the vault marker — on foot.' }),
      { kind: 'grab', target: LOCATIONS.casino, radius: 70, text: 'Grab the vault cash (on foot)' },
      gotoStep(LOCATIONS.safehouse, 90, 'Escape to the Safehouse', { speaker: 'Mara', text: 'We did it. $800, and the bay is ours. You are a legend of Solmar Bay now.' }),
    ],
  },
];

export function createMissions() {
  return {
    defs: MISSION_DEFS,
    current: -1,
    stepIndex: 0,
    timer: 0,
    dialogue: null,
    dialogueTime: 0,
    done: 0,
    failed: null,
  };
}

/** Start the next mission (or the one at `index`). Returns its intro lines. */
export function startMission(missions, index) {
  const next = index === undefined ? missions.done : index;
  if (next >= missions.defs.length) return null;
  missions.current = next;
  missions.stepIndex = 0;
  missions.timer = 0;
  missions.failed = null;
  const def = missions.defs[next];
  missions.dialogue = def.lines[0] || null;
  missions.dialogueTime = 5;
  return def;
}

export function currentDef(missions) {
  return missions.current < 0 ? null : missions.defs[missions.current];
}

export function currentStep(missions) {
  const def = currentDef(missions);
  return def ? def.steps[missions.stepIndex] : null;
}

/** The objective line the HUD shows, or the free-roam hint when no mission runs. */
export function objectiveText(missions) {
  const def = currentDef(missions);
  if (!def) {
    return missions.done >= missions.defs.length
      ? 'All missions complete — free roam Solmar Bay'
      : 'No mission active — press M to start the next job';
  }
  const step = currentStep(missions);
  const timer = step && step.time ? `  (${Math.max(0, Math.ceil(missions.timer))}s)` : '';
  return `${def.title}: ${step.text}${timer}`;
}

/**
 * Advance the active mission. `ctx` carries the player, the police and the callbacks the
 * mission needs (setWanted, addCash, toast). Returns 'complete' | 'failed' | null.
 */
export function updateMissions(missions, dt, ctx) {
  const def = currentDef(missions);
  if (!def) return null;
  const step = currentStep(missions);
  if (!step) return null;

  if (missions.dialogueTime > 0) {
    missions.dialogueTime -= dt;
    if (missions.dialogueTime <= 0) missions.dialogue = null;
  }

  if (step.time !== undefined) {
    if (missions.timer === 0) missions.timer = step.time;
    missions.timer -= dt;
    if (missions.timer <= 0) {
      missions.failed = def.title;
      missions.current = -1;
      ctx.toast(`Mission failed: ${def.title} — out of time. Press M to retry.`);
      return 'failed';
    }
  }

  const player = ctx.player;
  const px = player.x;
  const py = player.y;
  let arrived = false;

  if (step.kind === 'goto' || step.kind === 'timed') {
    const dx = px - step.target.x;
    const dy = py - step.target.y;
    arrived = dx * dx + dy * dy < step.radius * step.radius;
  } else if (step.kind === 'enterCar') {
    arrived = player.car !== null;
  } else if (step.kind === 'survive') {
    // Reach the safehouse while the heat is on; the timer is the escape window.
    const dx = px - step.target.x;
    const dy = py - step.target.y;
    arrived = dx * dx + dy * dy < step.radius * step.radius && ctx.wanted() === 0;
    if (step.time !== undefined && missions.timer === 0) missions.timer = step.time;
  } else if (step.kind === 'grab') {
    const dx = px - step.target.x;
    const dy = py - step.target.y;
    arrived = player.car === null && dx * dx + dy * dy < step.radius * step.radius;
  }

  if (arrived) {
    if (step.kind === 'grab') {
      ctx.setWanted(4);
      ctx.toast('Vault cash grabbed! The whole Bay PD is after you — run!');
    }
    if (step.line) {
      missions.dialogue = step.line;
      missions.dialogueTime = 5;
    }
    missions.stepIndex += 1;
    missions.timer = 0;
    if (missions.stepIndex >= def.steps.length) {
      missions.done += 1;
      missions.current = -1;
      ctx.addCash(def.reward);
      ctx.toast(`Mission complete: ${def.title} — +$${def.reward}`);
      return 'complete';
    }
  }
  return null;
}

/** Begin the heat-wave setup: three stars the moment the mission starts. */
export function applyMissionStart(missions, ctx) {
  const def = currentDef(missions);
  if (!def) return;
  if (def.id === 'heat-wave') ctx.setWanted(3);
  if (def.id === 'coral-heist') ctx.toast('The Coral Casino job is live. Stay sharp.');
}
