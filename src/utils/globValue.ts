import {Glob} from './CachedFS';
const minimatch = require('minimatch');
export function globValue(value: string, glob: Glob) {
    if (minimatch(value, glob)) {
        return true;
    }
    return false;
}
