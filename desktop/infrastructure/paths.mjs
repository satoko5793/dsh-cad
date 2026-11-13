import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Keep installed connector, profile and private-data paths stable across refactors.
export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const REPOSITORY_ROOT=path.dirname(ROOT);
