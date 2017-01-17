import "../helpers";
import {Glob} from "../utils/fs";
import {plugin} from "../packer";
import {Plugin} from "../utils/Plugin";
import * as UglifyJS from "uglify-js";
const uglify = require('uglify-js');

import path = require('path');
import {SourceError} from "../utils/SourceError";


export function uglifyjs(globFiles?: Glob, options: UglifyJS.MinifyOptions = {}) {
    return plugin('uglifyjs', async(plug: Plugin) => {
        options.fromString = true;
        const files = await plug.fs.findFiles(globFiles);
        files.forEach(file => {
            plug.fs.stage.addFile(file);
            plug.fs.watch(file);
        });

        const jsFiles = plug.fs.stage.list().filter(file => file.extName.match(/^js$/));
        const updatedFiles = jsFiles.filter(file => file.updated);
        for (let i = 0; i < updatedFiles.length; i++) {
            const file = updatedFiles[i];
            const source = await plug.fs.readContent(file);
            const jsName = file.dirName + '/' + file.getBasename(true) + '.js';
            const jsNameMap = file.dirName + '/' + file.getBasename(true) + '.js.map';
            if (plug.options.sourceMap) {
                options.outSourceMap = jsNameMap;
            }
            (options as any).outFileName = jsName;
            const result = UglifyJS.minify(source, options);
            const jsFile = plug.fs.createGeneratedFile(jsName, result.code, file);
            plug.fs.stage.addFile(jsFile);
            if (result.map) {
                const jsFileMap = plug.fs.createGeneratedFile(jsNameMap, result.map, file);
                plug.fs.stage.addFile(jsFileMap);
            }
        }

        const nonUpdatedFiles = jsFiles.filter(file => !file.updated);
        for (let i = 0; i < nonUpdatedFiles.length; i++) {
            const file = nonUpdatedFiles[i];
            file.createdFiles.forEach(f => plug.fs.stage.addFile(f));
        }
    });
}