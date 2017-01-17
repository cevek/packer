import {plugin} from '../packer';
import {Glob} from '../utils/fs';
import {Plugin} from '../utils/Plugin';

export function src(globFiles: Glob) {
    return plugin('src', async(plug: Plugin) => {
        const files = await plug.fs.findFiles(globFiles);
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            plug.fs.stage.addFile(file);
        }
    });
}

