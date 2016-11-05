import {plugin} from "../packer";
import {Plug} from "../utils/Plugin";
export function dest() {
    return plugin('dest', async(plug: Plug) => {
        const files = plug.fs.getGeneratedFiles();
        // plug.printAllGeneratedFiles();
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.isGenerated && file.updated && file.fullName.indexOf(plug.options.dest) === 0) {
                await plug.fs.write(file);
            }
        }
    });
}