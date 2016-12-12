import "../helpers";
import {plugin} from "../packer";
import {Plugin} from "../utils/Plugin";

export function replaceCode(replace: {[key: string]: string}) {
    return plugin('replaceCode', async(plug: Plugin) => {
        const keys = Object.keys(replace);
        const replaceKeys = keys.map(key => new RegExp(key, 'g'));
        const values = keys.map(key => replace[key]);
        const destJsFiles = plug.stage.list().filter(file => plug.inDestFolder(file) && file.extName == 'js');
        for (let i = 0; i < destJsFiles.length; i++) {
            const file = destJsFiles[i];
            let content = await plug.fs.readContent(file);
            for (let j = 0; j < replaceKeys.length; j++) {
                const key = replaceKeys[j];
                const value = values[i];
                content = content.replace(key, value);
            }
            file.setContent(content);
        }
    });
}