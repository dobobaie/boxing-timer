import { Profile } from '../types';
import { uid } from '../utils/ids';

export function defaultProfile(): Profile {
  return {
    id: uid('p_'),
    name: 'Classic',
    totalRounds: 5,
    timers: [
      { id: uid('t_'), name: 'Rest', durationSec: 60, rules: [], triggers: [] },
      { id: uid('t_'), name: 'Fight', durationSec: 180, rules: [], triggers: [] },
    ],
  };
}

export function pyramidProfile(): Profile {
  // A pyramid expressed with triggers (a sequential state machine):
  //   T1: from round 1, add 10s each round  -> ramps up
  //   T2: once the timer reaches 60s, subtract 10s each round (cancels T1) -> ramps down
  // Over 11 rounds the single Fight timer runs 10,20,30,40,50,60,50,40,30,20,10.
  return {
    id: uid('p_'),
    name: 'Pyramid',
    totalRounds: 11,
    timers: [
      {
        id: uid('t_'),
        name: 'Fight',
        durationSec: 10,
        rules: [],
        triggers: [
          {
            id: uid('g_'),
            when: { metric: 'round', op: '==', value: 1 },
            apply: { op: '+', value: 10 },
            appliesTo: 'previous',
          },
          {
            id: uid('g_'),
            when: { metric: 'duration', op: '>=', value: 60 },
            apply: { op: '-', value: 10 },
            appliesTo: 'previous',
          },
        ],
      },
    ],
  };
}
