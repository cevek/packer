import path = require('path');
import {promisify} from "../utils/promisify";
import {Glob} from "../utils/fs";
import {plugin} from "../packer";
import {Plug} from "../utils/Plugin";

const render: (options: SassOptions) => Promise<SassResult> = promisify(require('node-sass').render);
// const sassRender: (options: SassOptions) => Promise<SassResult> = promisify(require('node-sass').render);
export interface SassOptions {
    file?: string;
    data?: string;
    includePaths?: string[];
    sourceMap?: boolean | string;
    outFile?: string;
}

export interface SassResult {
    css: string;
    map: string;
    stats: {
        entry: string;
        start: number;
        end: number;
        duration: number;
        includedFiles: string[];
    }
}

export function sass(globFiles: Glob, options: SassOptions = {}) {
    return plugin('sass', async(plug: Plug) => {
        if (options.sourceMap == null) {
            options.sourceMap = plug.options.sourceMap;
        }
        const files = await plug.fs.findFiles(globFiles);
        files.forEach(file => plug.stage.addFile(file));

        const updatedFiles = plug.stage.list().filter(file => file.updated && file.extName.match(/^s[ac]ss$/));
        for (let i = 0; i < updatedFiles.length; i++) {
            const file = updatedFiles[i];
            const cssName = file.dirName + '/' + file.getBasename(true) + '.css';

            options.file = file.fullName;
            options.outFile = cssName;
            options.data = await plug.fs.readContent(file);
            const result = await render(options);
            const cssFile = plug.fs.createGeneratedFile(cssName, result.css);
            plug.stage.addFile(cssFile);
            for (let j = 0; j < result.stats.includedFiles.length; j++) {
                const filename = result.stats.includedFiles[j];
                const file = plug.fs.findOrCreate(filename);
                plug.fs.watch(file);
            }
            if (result.map) {
                plug.fs.createGeneratedFile(cssName + '.map', result.map);
            }
        }
    });
}