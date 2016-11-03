import {plugin, Plug} from '../packer';

export function dest() {
    return plugin('dest', async plug => {
        const files = plug.getGeneratedFiles().filter(f => !f.fromFileSystem && f.updated);
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            await file.writeFileToFS();
        }
    });
}