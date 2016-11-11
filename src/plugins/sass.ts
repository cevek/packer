import '../helpers';
import path = require('path');
import {promisify} from "../utils/promisify";
import {Glob} from "../utils/fs";
import {plugin} from "../packer";
import {Plugin} from "../utils/Plugin";

const render: (options: SassOptions) => Promise<SassResult> = promisify(require('node-sass').render);
// const sassRender: (options: SassOptions) => Promise<SassResult> = promisify(require('node-sass').render);
export interface SassImporter {
    (url: string, prev: string, done: (data: { file: string; contents: string; }) => void): void;
}
export interface SassOptions {
    file?: string;
    data?: string;
    includePaths?: string[];
    sourceMap?: boolean | string;
    outFile?: string;
    importer?: SassImporter | SassImporter[];
    functions?: { [key: string]: Function };
    indentedSyntax?: boolean;
    indentType?: string;
    indentWidth?: number;
    linefeed?: string;
    omitSourceMapUrl?: boolean;
    outputStyle?: string;
    precision?: number;
    sourceComments?: boolean;
    sourceMapContents?: boolean;
    sourceMapEmbed?: boolean;
    sourceMapRoot?: boolean;
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

export function sass(globFiles?: Glob, options: SassOptions = {}) {
    return plugin('sass', async(plug: Plugin) => {
        if (options.sourceMap == null) {
            options.sourceMap = plug.options.sourceMap;
        }
        const files = await plug.fs.findFiles(globFiles);
        files.forEach(file => {
            plug.stage.addFile(file);
            plug.fs.watch(file);
        });

        const sassFiles = plug.stage.list().filter(file => file.extName.match(/^s[ac]ss$/));
        for (let i = 0; i < sassFiles.length; i++) {
            const file = sassFiles[i];
            if (file.imports) {
                for (let j = 0; j < file.imports.length; j++) {
                    const imprt = file.imports[j];
                    if (imprt.file.updated) {
                        file.updated = true;
                    }
                }
            }
        }

        const updatedFiles = sassFiles.filter(file => file.updated);
        for (let i = 0; i < updatedFiles.length; i++) {
            const file = updatedFiles[i];
            const cssName = file.dirName + '/' + file.getBasename(true) + '.css';

            options.file = file.fullName;
            options.outFile = cssName;
            options.data = await plug.fs.readContent(file);
            const result = await render(options);
            const cssFile = plug.fs.createGeneratedFile(cssName, result.css);
            file.imports = [];
            plug.stage.addFile(cssFile);
            for (let j = 0; j < result.stats.includedFiles.length; j++) {
                const filename = result.stats.includedFiles[j];
                const depFile = plug.fs.findOrCreate(filename);
                plug.fs.watch(depFile);
                file.imports.push({
                    file: depFile,
                    module: null,
                    startPos: null,
                    endPos: null
                });
            }
            if (result.map) {
                plug.fs.createGeneratedFile(cssName + '.map', result.map);
            }
        }
    });
}