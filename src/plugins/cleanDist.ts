import {plugin} from '../packer';
import {Plugin} from '../utils/Plugin';
import {unlinkSync} from 'fs';
import {logger} from '../utils/logger';

export function cleanDist() {
    return plugin('cleanDist', async(plug: Plugin) => {
        const files = await plug.fs.findFiles(plug.options.dest + '/**/*');
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
                if (!file.isDir && !file.isGenerated) {
                    unlinkSync(file.fullName);
                }
            } catch (e) {
                logger.error('Cannot remove file ' + file.fullName);
            }
        }
    });
}

