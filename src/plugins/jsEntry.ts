import {plugin} from '../packer';
import {Plugin} from "../utils/Plugin";

export function jsEntry(filename: string) {
    return plugin('jsEntry', async (plug: Plugin) => {
        filename = plug.normalizeName(filename);
        // console.log(plug.list.map(f => f.fullName));
        const file = await plug.fs.getFromCache(filename);
        if (!file) {
            plug.printAllGeneratedFiles();
            throw new Error(`jsEntry: file ${filename} doesn't exist`);
        }
        plug.jsEntries.push(file);
        // console.log('add entry', filename);
    });
}