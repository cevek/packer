import {plugin} from "../packer";
import {Plugin} from "../utils/Plugin";
import * as path from "path";
import {makeHashBinary} from "../utils/makeHash";

export function hash(predicator?: (filename: string) => boolean) {
    return plugin('hash', async(plug: Plugin) => {
        const files = await plug.fs.stage.list();
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            let relativeName = path.relative(plug.options.context, file.fullName);
            if ((!predicator || predicator(relativeName)) && file.nameCanBeHashed && plug.inDestFolder(file)) {
                await plug.fs.readContent(file);
                const binaryContent = file.content;
                const hashInt = makeHashBinary(binaryContent).toString(36);
                const newName = file.dirName + '/' + file.getBasename(true) + '_' + hashInt + '.' + file.extName;
                plug.fs.rename(file, newName);
            }
        }
    });
}

