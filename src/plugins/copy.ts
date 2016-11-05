import {plugin} from "../packer";
import {Glob} from "../utils/fs";
import {Plug} from "../utils/Plugin";

export function copy(globFiles: Glob) {
    return plugin('copy', async(plug: Plug) => {
        const files = await plug.fs.findFiles(globFiles);
        files.filter(file => file.updated).forEach(file => file.isGenerated = true);
    });
}