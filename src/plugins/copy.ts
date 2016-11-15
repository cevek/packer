import {plugin} from "../packer";
import {Glob} from "../utils/fs";
import {Plugin} from "../utils/Plugin";

export function copy(globFiles: Glob) {
    return plugin('copy', async(plug: Plugin) => {
        const files = await plug.fs.findFiles(globFiles);
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const destFileName = plug.normalizeDestName(file.fullName);
            const destFile = await plug.fs.createGeneratedFromFile(destFileName, file);
            plug.stage.addFile(destFile);
        }
    });
}