import {plugin} from "../packer";
import {Glob} from "../utils/fs";
import {Plug} from "../utils/Plugin";

export function copy(globFiles: Glob) {
    return plugin('copy', async(plug: Plug) => {
        const files = await plug.fs.findFiles(globFiles);
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const destFileName = plug.normalizeDestName(file.fullName);
            const destFile = plug.fs.createGeneratedFile(destFileName, file.fullName);
            plug.stage.addFile(destFile);
        }
    });
}