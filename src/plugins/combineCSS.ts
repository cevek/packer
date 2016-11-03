import {plugin, Plug} from '../packer';

export function combineCSS(outfile: string) {
    return plugin('combineCSS', async plug => {
        /*const files = plug.getGeneratedFiles().filter(file => file.ext == 'css');
        if (files.length) {
            await combine(() => '', () => '', outfile, plug, files, () => '', () => '\n');
        } else {
            logger.warning('Nothing to combine css');
        }*/
    });
}