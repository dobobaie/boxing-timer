import { Profile } from '../types';
import { uid } from '../utils/ids';

export function defaultProfile(): Profile {
  return {
    id: uid('p_'),
    name: 'Classic',
    totalRounds: 5,
    timers: [
      { id: uid('t_'), name: 'Rest', durationSec: 60, rules: [] },
      { id: uid('t_'), name: 'Fight', durationSec: 180, rules: [] },
    ],
  };
}

export function pyramidProfile(): Profile {
  const fightId = uid('t_');
  return {
    id: uid('p_'),
    name: 'Pyramid',
    totalRounds: 8,
    timers: [
      { id: uid('t_'), name: 'Rest', durationSec: 10, rules: [] },
      {
        id: fightId,
        name: 'Fight',
        durationSec: 10,
        rules: [
          // Ramp up: double the previous round's fight for the first 4 rounds.
          {
            id: uid('r_'),
            when: { metric: 'round', op: '<=', value: 4 },
            apply: { op: '*', value: 2 },
            appliesTo: 'previous',
          },
          // Ramp down: halve the previous round's fight from round 5 onward.
          {
            id: uid('r_'),
            when: { metric: 'round', op: '>=', value: 5 },
            apply: { op: '/', value: 2 },
            appliesTo: 'previous',
          },
        ],
      },
    ],
  };
}
