import {plugin} from "../packer";
import {Plugin} from "../utils/Plugin";
import * as path from "path";

export function hash(predicator?: (filename: string) => boolean) {
    return plugin('hash', async(plug: Plugin) => {
        const files = await plug.stage.list();
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            let relativeName = path.relative(plug.options.context, file.fullName);
            if ((!predicator || predicator(relativeName)) && file.nameCanBeHashed) {
                const hashInt = makeHash(await plug.fs.readContent(file)).toString(36);
                const newName = file.dirName + '/' + file.getBasename(true) + '_' + hashInt + '.' + file.extName;
                plug.fs.rename(file, newName);
            }
        }
    });
}


//https://github.com/darkskyapp/string-hash
function makeHash(str: string) {
    let hash = 5381;
    let i = str.length;
    while (i) {
        hash = (hash * 33) ^ str.charCodeAt(--i)
    }
    /* JavaScript does bitwise operations (like XOR, above) on 32-bit signed
     * integers. Since we want the results to be always positive, convert the
     * signed int to an unsigned by doing an unsigned bitshift. */
    return hash >>> 0;
}