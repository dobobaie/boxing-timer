import { Profile } from '../types';
import { uid } from '../utils/ids';

export function defaultProfile(): Profile {
  return {
    id: uid('p_'),
    name: 'Classic',
    totalRounds: 5,
    cycles: 1,
    cycleRestSec: 60,
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
  // The editor recognises this shape as the "Pyramid" preset.
  return {
    id: uid('p_'),
    name: 'Pyramid',
    totalRounds: 11,
    cycles: 1,
    cycleRestSec: 60,
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

export function emptyProfile(name: string): Profile {
  return {
    id: uid('p_'),
    name,
    totalRounds: 3,
    cycles: 1,
    cycleRestSec: 60,
    timers: [{ id: uid('t_'), name: 'Round', durationSec: 120, rules: [], triggers: [] }],
  };
}

/** Deep clone with fresh ids everywhere, so editing the copy never touches the source. */
export function cloneProfile(src: Profile, name: string): Profile {
  return {
    id: uid('p_'),
    name,
    totalRounds: src.totalRounds,
    cycles: src.cycles ?? 1,
    cycleRestSec: src.cycleRestSec ?? 60,
    timers: src.timers.map((t) => ({
      ...t,
      id: uid('t_'),
      rules: (t.rules ?? []).map((r) => ({ ...r, id: uid('r_') })),
      triggers: (t.triggers ?? []).map((g) => ({ ...g, id: uid('g_') })),
    })),
  };
}

export type ProfileTemplate = 'current' | 'classic' | 'pyramid' | 'empty';

export const PROFILE_TEMPLATES: { value: ProfileTemplate; label: string; hint: string }[] = [
  { value: 'current', label: 'Copy current', hint: 'Start from the profile you are using now' },
  { value: 'classic', label: 'Classic', hint: '5 × 3:00 rounds with 1:00 rest' },
  { value: 'pyramid', label: 'Pyramid', hint: '11 rounds climbing to 1:00 then back down' },
  { value: 'empty', label: 'Blank', hint: '3 rounds of 2:00, nothing else' },
];

export function profileFromTemplate(
  template: ProfileTemplate,
  name: string,
  current: Profile
): Profile {
  switch (template) {
    case 'current':
      return cloneProfile(current, name);
    case 'classic':
      return { ...defaultProfile(), name };
    case 'pyramid':
      return { ...pyramidProfile(), name };
    case 'empty':
      return emptyProfile(name);
  }
}
