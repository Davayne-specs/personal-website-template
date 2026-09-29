import {SceneDef} from '../../../lib/scene';
import {CHORUS} from './chorus';
import {CHORUS2} from './chorus2';
import {OUTRO} from './outro';
import {VERSE1} from './verse1';
import {VERSE2} from './verse2';

export const SCENES: Record<number, SceneDef> = {...VERSE1, ...VERSE2, ...CHORUS, ...CHORUS2, ...OUTRO};
