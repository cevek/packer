import "../helpers";
import {Glob} from "../utils/fs";
import {plugin} from "../packer";
import {Plugin} from "../utils/Plugin";
import {logger} from "../utils/logger";
import * as Postcss from 'postcss';

export function postcss(globFiles?: Glob, plugins: Postcss.Plugin<any>[] = [], options: Postcss.ProcessOptions = {}) {
    return plugin('postcss', async(plug: Plugin) => {
        if (plug.options.sourceMap) {
            options.map = {
                inline: true
            }
        }

        const files = await plug.fs.findFiles(globFiles);
        files.forEach(file => {
            plug.stage.addFile(file);
            plug.fs.watch(file);
        });

        const cssFiles = plug.stage.list().filter(file => file.extName == 'css');
        for (let i = 0; i < cssFiles.length; i++) {
            const file = cssFiles[i];
            if (file.imports) {
                for (let j = 0; j < file.imports.length; j++) {
                    const imprt = file.imports[j];
                    if (imprt.file.updated) {
                        file.updated = true;
                    }
                }
            }
        }

        const p = Postcss(plugins);
        const updatedFiles = cssFiles.filter(file => file.updated);
        for (let i = 0; i < updatedFiles.length; i++) {
            const file = updatedFiles[i];
            const cssName = file.dirName + '/' + file.getBasename(true) + '.css';

            const cssData = await plug.fs.readContent(file);
            options.from = file.fullName;
            options.to = file.fullName;
            const result = await p.process(cssData, options);

            const cssFile = plug.fs.createGeneratedFile(cssName, result.css, file);
            file.imports = [];
            plug.stage.addFile(cssFile);

            result.messages.forEach(message => logger.info(JSON.stringify(message)));

            //todo:
            /*for (let j = 0; j < result.stats.includedFiles.length; j++) {
                const filename = result.stats.includedFiles[j];
                const depFile = plug.fs.findOrCreate(filename);
                plug.fs.watch(depFile);
                file.imports.push({
                    file: depFile,
                    module: null,
                    startPos: null,
                    endPos: null
                });
            }*/
        }

        const nonUpdatedFiles = cssFiles.filter(file => !file.updated);
        for (let i = 0; i < nonUpdatedFiles.length; i++) {
            const file = nonUpdatedFiles[i];
            file.createdFiles.forEach(f => plug.stage.addFile(f));
        }
    });
}