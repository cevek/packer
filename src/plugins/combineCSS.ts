import {plugin} from "../packer";
import {Plug} from "../utils/Plugin";
import {combiner} from "../utils/combiner";

export function combineCSS(outfile: string) {
    return plugin('combineCSS', async (plug: Plug) => {
        const fullOutfile = plug.normalizeDestName(outfile);
        const files = plug.stage.list().filter(file => file.extName === 'css' && file.fullName !== fullOutfile);
        const hasUpdates = files.some(file => file.updated);
        // console.log(hasUpdates, files.length);
        if (hasUpdates) {
            await combiner({
                type: 'css',
                plug,
                outfile,
                files,
                superHeader: '',
                getFooter: file => '\n',
                getContent: async file => plug.fs.readContent(file),
                superFooter: '',
            });
        }
    });
}