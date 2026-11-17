// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between five screens: title, play, paused, busted and wasted.
// Missions start with N; progress is saved to localStorage when a job ends.
//
// ?seed=N fixes the city. ?shot=start|drive|chase|mission (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady for
// a screenshot.

import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BUSTED, EVENT_MISSION, EVENT_WASTED } from './world.js';
import { ACTION_CONFIRM, ACTION_MISSION, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED } from './render.js';
import { stageShot } from './shots.js';
import { createAudio } from './audio.js';
import { loadSave, saveGame } from './save.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;
/** How long the busted / wasted panel stays up before play resumes. */
const END_SCREEN_SECONDS = 2.5;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(() => createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, { cash: world.state.player.cash, done: world.state.missions.done });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  const save = loadSave();
  if (save) world.loadData(save);
  let screen = SCREEN_TITLE;
  let endTimer = 0;
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function persist() {
    const data = world.saveData();
    saveGame(data);
  }

  function startGame() {
    world.reset();
    const fresh = loadSave();
    if (fresh) world.loadData(fresh);
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing Solmar Bay. Press N to start the next job.');
  }

  function handleEvents(events) {
    if (events & EVENT_MISSION) persist();
    if (events & EVENT_BUSTED) {
      screen = SCREEN_BUSTED;
      endTimer = END_SCREEN_SECONDS;
      persist();
      announce('Busted. The Bay PD took their fine.');
    } else if (events & EVENT_WASTED) {
      screen = SCREEN_WASTED;
      endTimer = END_SCREEN_SECONDS;
      persist();
      announce('Wasted. St. Marina patched you up.');
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      audio.setMuted(!audio.isMuted());
      announce(audio.isMuted() ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_MISSION && screen === SCREEN_PLAY) {
      const def = world.startNextMission();
      if (def) {
        audio.ensure();
        announce(`Mission started: ${def.title}. ${def.intro}`);
      } else {
        announce('All four missions are done. Free roam!');
      }
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_BUSTED || screen === SCREEN_WASTED)) {
      if (screen === SCREEN_TITLE) {
        audio.ensure();
        audio.click();
        startGame();
      } else if (endTimer <= 0) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      // The city lives behind the title: traffic drives, pedestrians stroll.
      world.step(STEP, { x: 0, y: 0, sprint: false, brake: false, enter: false, punch: false }, null);
      return;
    }
    const events = world.step(STEP, input.controls(), audio);
    handleEvents(events);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    accumulator += dt;
    handleActions();
    if (screen === SCREEN_BUSTED || screen === SCREEN_WASTED) {
      // The panel stays until the player presses Space; the timer only unlocks that.
      endTimer -= dt;
    }
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, { cash: world.state.player.cash, done: world.state.missions.done });
  }

  // Leaving the tab pauses a running game rather than letting the police close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Solmar Bay. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
