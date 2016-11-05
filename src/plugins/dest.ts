import {plugin, Plug} from "../packer";
Plug;
export function dest() {
    return plugin('dest', async plug => {
        const files = plug.getGeneratedFiles();
        // plug.printAllGeneratedFiles();
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (!file.fromFileSystem && file.updated && file.fullName.indexOf(plug.options.dest) === 0) {
                await file.writeFileToFS();
            }
        }
    });
}