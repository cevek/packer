import {plugin, Plug} from '../packer';
import {logger} from "../utils/logger";

export function dest() {
    return plugin('dest', async plug => {

        // plug.getGeneratedFiles().filter(f => !f.fromFileSystem).forEach(file => logger.data('  ' + file.relativeName));

        const files = plug.getGeneratedFiles().filter(f => !f.fromFileSystem && f.updated);
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            await file.writeFileToFS();
        }
    });
}