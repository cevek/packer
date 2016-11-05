import {plugin} from '../packer';
import {Plug} from "../utils/Plugin";

export function jsEntry(filename: string) {
    return plugin('jsEntry', async (plug: Plug) => {
        filename = plug.normalizeName(filename);
        // console.log(plug.list.map(f => f.fullName));
        const file = await plug.fs.getFromCache(filename);
        if (!file) {
            throw new Error(`jsEntry: file ${filename} doesn't exist`);
        }
        plug.jsEntries.push(file);
        // console.log('add entry', filename);
    });
}