import {plugin} from "../packer";
import {Plugin} from "../utils/Plugin";
import {logger} from "../utils/logger";
import {padRight, padLeft, formatBytes} from "../utils/common";
export function dest() {
    return plugin('dest', async(plug: Plugin) => {
        // const files = plug.fs.getGeneratedFiles();
        const files = plug.stage.list();
        // plug.printAllGeneratedFiles()
        // plug.printStageFiles();
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.updated && plug.inDestFolder(file)) {
                await plug.fs.write(file);
                const content = await plug.fs.readContent(file);//todo: buffer length
                plug.outputFiles.add(file);
                logger.success(padRight(`Emit file: ${plug.fs.relativeName(file)}`, 40) + padLeft(formatBytes(content.length), 10));
            }
        }
    });
}