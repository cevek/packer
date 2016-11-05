import {plugin} from "../packer";
import {Plug} from "../utils/Plugin";
import {combiner} from "../utils/combiner";

export function combineCSS(outfile: string) {
    return plugin('combineCSS', async (plug: Plug) => {
        const files = plug.fs.getGeneratedFiles().filter(file => file.extName === 'css' && file.fullName !== outfile);
        const hasUpdates = files.some(file => file.updated);
        if (hasUpdates) {
            await combiner({
                plug,
                outfile,
                files,
                getFooter: file => '\n',
                getContent: file => file.contentString
            });
        }
    });
}