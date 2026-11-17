// Keyboard and pointer input. Held keys give a movement vector; one-shot presses
// (enter a car, punch, pause, mute, confirm) are queued as flags and taken once by the
// loop, so a press between two frames is never lost and never counted twice.
// Controls: W/S or Up/Down move, A/D or Left/Right steer, E enter/exit a car,
// Space punch (on foot) or handbrake (in a car), Shift run, P pause, M mute.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_MISSION = 8;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER_CAR = new Set(['KeyE']);
const SPRINT = new Set(['ShiftLeft', 'ShiftRight']);
const MUTE = new Set(['KeyM']);
const MISSION = new Set(['KeyN']);

export function createInput(target) {
  const held = new Set();
  let actions = 0;
  let enterPressed = false;
  let punchPressed = false;

  function onKeyDown(event) {
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) {
      held.add(event.code);
    } else if (CONFIRM.has(event.code)) {
      // Space doubles as the handbrake in a car, so it is held as well as pressed.
      held.add(event.code);
      if (!event.repeat) {
        actions |= ACTION_CONFIRM;
        punchPressed = true;
      }
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (ENTER_CAR.has(event.code)) {
      if (!event.repeat) enterPressed = true;
    } else if (SPRINT.has(event.code)) {
      held.add(event.code);
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (MISSION.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MISSION;
    } else {
      return;
    }
    event.preventDefault();
  }

  function onKeyUp(event) {
    held.delete(event.code);
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => held.clear());
  target.addEventListener('pointerdown', () => {
    actions |= ACTION_CONFIRM;
  });

  function hasAny(set) {
    for (const code of set) if (held.has(code)) return true;
    return false;
  }

  return {
    /** The movement vector for this frame: x (steer) and y (throttle) in -1..1. */
    controls() {
      const x = (hasAny(RIGHT) ? 1 : 0) - (hasAny(LEFT) ? 1 : 0);
      const y = (hasAny(DOWN) ? 1 : 0) - (hasAny(UP) ? 1 : 0);
      const controls = {
        x, y,
        sprint: hasAny(SPRINT),
        brake: hasAny(CONFIRM),
        enter: enterPressed,
        punch: punchPressed,
      };
      enterPressed = false;
      punchPressed = false;
      return controls;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
