// Save and load, through localStorage only. A save holds the cash, how many of Mara's
// four missions are done, and the best cash earned; a broken or missing save is simply
// an empty one, never an error.

import { SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const save = JSON.parse(raw);
    if (!save || typeof save !== 'object') return null;
    return {
      cash: typeof save.cash === 'number' ? save.cash : 0,
      done: typeof save.done === 'number' ? save.done : 0,
      best: typeof save.best === 'number' ? save.best : 0,
    };
  } catch {
    return null;
  }
}

export function saveGame(data) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: Math.floor(data.cash || 0),
      done: data.done || 0,
      best: Math.floor(data.best || 0),
    }));
    return true;
  } catch {
    // Storage can be off (private windows): the save then lasts this visit only.
    return false;
  }
}
