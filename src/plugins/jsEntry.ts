import {plugin, Plug} from '../packer';


export function jsEntry(filename: string) {
    return plugin('jsEntry', async plug => {
        filename = plug.normalizeDestName(filename);
        // console.log(plug.list.map(f => f.fullName));
        const file = await plug.getFileFromStage(filename);
        if (!file) {
            throw new Error(`jsEntry: file ${filename} doesn't exist`);
        }
        plug.jsEntries.push(file);
        // console.log('add entry', filename);
    });
}