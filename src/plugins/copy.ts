import {plugin} from "../packer";
import {Glob} from "../utils/fs";
import {Plugin} from "../utils/Plugin";
import * as path from 'path';

export function copy(globFiles: Glob, pathModificator?: (filename: string) => string) {
    return plugin('copy', async(plug: Plugin) => {
        const files = await plug.fs.findFiles(globFiles);
        const changedFiles = files.filter(file => file.updated);
        const unchangedFiles = files.filter(file => !file.updated);
        for (let i = 0; i < changedFiles.length; i++) {
            const file = changedFiles[i];
            let relativeName = path.relative(plug.options.context, file.fullName);
            if (pathModificator) {
                relativeName = pathModificator(relativeName);
            }
            const destFileName = plug.normalizeDestName(relativeName);
            const destFile = await plug.fs.createGeneratedFromFile(destFileName, file, file);
            destFile.nameCanBeHashed = false;
            plug.stage.addFile(destFile);
        }

        for (let i = 0; i < unchangedFiles.length; i++) {
            const file = unchangedFiles[i];
            file.createdFiles.forEach(f => plug.stage.addFile(f));
        }
    });
}

