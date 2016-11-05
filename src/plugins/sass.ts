import path = require('path');
import {promisify} from "../utils/promisify";
import {Glob} from "../utils/fs";
import {plugin} from "../packer";
import {Plug} from "../utils/Plugin";

const sassRender: (options: SassOptions) => Promise<SassResult> = promisify(require('node-sass').render);
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
    return plugin('sass', async (plug: Plug) => {
        if (options.sourceMap == null) {
            options.sourceMap = true;
        }
        const files = await plug.fs.findFiles(globFiles);
        const updatedFiles = files.filter(file => file.updated);
        for (let i = 0; i < updatedFiles.length; i++) {
            const file = updatedFiles[i];
            const cssName = file.dirName + file.getBasename(true) + '.css';

            options.file = file.fullName;
            options.outFile = cssName + '.map';
            options.data = file.contentString;
            const result = await sassRender(options);
            plug.fs.createGeneratedFile(cssName, result.css);
            for (let j = 0; j < result.stats.includedFiles.length; j++) {
                const filename = result.stats.includedFiles[j];
                await plug.fs.read(filename);
            }
            if (result.map) {
                plug.fs.createGeneratedFile(cssName + '.map', result.map);
            }
        }
    });
}