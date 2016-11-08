import {plugin} from "../packer";
import {Plug} from "../utils/Plugin";
import {logger} from "../utils/logger";
import {padRight, padLeft, formatBytes} from "../utils/common";
export function dest() {
    return plugin('dest', async(plug: Plug) => {
        // const files = plug.fs.getGeneratedFiles();
        const files = plug.stage.list();
        // plug.printAllGeneratedFiles()
        // plug.printStageFiles();
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.updated && file.fullName.indexOf(plug.options.dest) === 0) {
                await plug.fs.write(file);
                logger.success(padRight(`Emit file: ${plug.fs.relativeName(file)}`, 40) + padLeft(formatBytes(file.content.length), 10));
            }
        }
    });
}