// Web-prototype defaults over the application-neutral DSH transport.
import path from 'node:path';
import {ROOT} from './build.mjs';
import {Harness as SharedHarness} from '../shared/harness.mjs';
export class Harness extends SharedHarness {
  constructor(notify,options={}){super(notify,{cwd:ROOT,prompt:path.join(ROOT,'prompt.txt'),plugin:path.join(ROOT,'cad-plugin.mjs'),profile:'cad-studio',...options});}
}
