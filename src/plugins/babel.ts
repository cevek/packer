import {Glob} from "../utils/fs";
import {plugin} from "../packer";
import {Plugin} from "../utils/Plugin";
import { transform, TransformOptions, BabelFileResult } from 'babel-core';

import path = require('path');
import {SourceError} from "../utils/SourceError";

export function babel(globFiles?: Glob, options: TransformOptions = {}) {
    return plugin('babel', async(plug: Plugin) => {
        if (plug.options.sourceMap) {
            options.sourceMaps = 'inline';
        }
        const files = await plug.fs.findFiles(globFiles);
        files.forEach(file => {
            plug.fs.stage.addFile(file);
            plug.fs.watch(file);
        });

        const jsFiles = plug.fs.stage.list().filter(file => file.extName.match(/^(jsx?|es6?)$/));
        const updatedFiles = jsFiles.filter(file => file.updated);
        for (let i = 0; i < updatedFiles.length; i++) {
            const file = updatedFiles[i];

            const source = await plug.fs.readContent(file);
            options.filename = file.fullName;

            let result: BabelFileResult;
            try {
                result = transform(source, options);
            } catch (error) {
                if (error.message && error.loc) {
                    const message = error.message.replace(/^[^:]+: /, "");
                    if (error instanceof SyntaxError) {
                    } else if (error instanceof TypeError) {
                    }
                    throw new SourceError(message, file, error.loc.line, error.loc.column);
                } else {
                    throw error;
                }
            }

            const jsName = file.dirName + file.getBasename(true) + '.js';
            const jsFile = plug.fs.createGeneratedFile(jsName, result.code, file);
            plug.fs.stage.addFile(jsFile);
        }

        const nonUpdatedFiles = jsFiles.filter(file => !file.updated);
        for (let i = 0; i < nonUpdatedFiles.length; i++) {
            const file = nonUpdatedFiles[i];
            file.createdFiles.forEach(f => plug.fs.stage.addFile(f));
        }
    });
}