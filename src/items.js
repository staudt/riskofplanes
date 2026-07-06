import { PALETTE, PRICE_WAVE_GROWTH } from './constants.js';

// Item registry. Effects are hooked where they act (see CLAUDE.md):
// derived stats on the player (recomputed by game.applyItems), event flags,
// or checks in game.js update/damageEnemy.
export const ITEMS = {
  rapid: {
    id: 'rapid',
    name: 'RAPID FIRE',
    color: PALETTE.gold,
    basePrice: 40,
  },
  volatile: {
    id: 'volatile',
    name: 'VOLATILE KILLS',
    color: PALETTE.coral,
    basePrice: 55,
  },
  ricochet: {
    id: 'ricochet',
    name: 'RICOCHET ROUNDS',
    color: PALETTE.waterSurface,
    basePrice: 35,
  },
  seeker: {
    id: 'seeker',
    name: 'SEEKER MISSILES',
    color: PALETTE.white,
    basePrice: 60,
  },
  bombs: {
    id: 'bombs',
    name: 'DEPTH BOMBS',
    color: PALETTE.teal,
    basePrice: 50,
  },
  gunnerDrone: {
    id: 'gunnerDrone',
    name: 'GUNNER DRONE',
    color: PALETTE.green,
    basePrice: 65,
  },
  repairDrone: {
    id: 'repairDrone',
    name: 'REPAIR DRONE',
    color: PALETTE.greenDark,
    basePrice: 55,
  },
};

export const ITEM_IDS = Object.keys(ITEMS);

export function itemPrice(item, wave) {
  return Math.round(item.basePrice * (1 + PRICE_WAVE_GROWTH * (wave - 1)));
}
