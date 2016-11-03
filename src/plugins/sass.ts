import path = require('path');
import {promisify} from '../utils/promisify';
import {Glob} from '../utils/fs';
import {plugin, Plug} from '../packer';


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
    return plugin('sass', async plug => {
        if (options.sourceMap == null) {
            options.sourceMap = true;
        }
        const files = await plug.findFiles(globFiles);
        const updatedFiles = files.filter(file => file.updated);
        for (let i = 0; i < updatedFiles.length; i++) {
            const file = updatedFiles[i];
            const cssName = file.dirname + file.basenameWithoutExt + '.css';
    
            options.file = file.fullName;
            options.outFile = cssName + '.map';
            options.data = file.contentString;
            const result = await sassRender(options);
            plug.addDistFile(cssName, result.css);
            for (let j = 0; j < result.stats.includedFiles.length; j++) {
                const filename = result.stats.includedFiles[j];
                await plug.addFileFromFS(filename)
            }
            if (result.map) {
                plug.addDistFile(cssName + '.map', result.map);
            }
        }
    });
}