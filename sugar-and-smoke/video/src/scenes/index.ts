import {SLOTS} from '../lib/timeline';
import {HOOK1} from './hook1';
import {HOOK2} from './hook2';
import {OUTRO} from './outro';
import {Placeholder} from './Placeholder';
import {PRESSURE} from './pressure';
import {SceneDef} from './types';
import {VERSE1} from './verse1';
import {VERSE2} from './verse2';

const defined: Record<number, SceneDef> = {...VERSE1, ...VERSE2, ...HOOK1, ...HOOK2, ...PRESSURE, ...OUTRO};

export const SCENES: Record<number, SceneDef> = Object.fromEntries(SLOTS.map((s) => [s.n, defined[s.n] ?? Placeholder]));

export const MISSING = SLOTS.filter((s) => !defined[s.n]).map((s) => s.n);
