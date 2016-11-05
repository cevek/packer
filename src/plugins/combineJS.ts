import {plugin} from "../packer";
import {JSScanner} from "../utils/jsParser/jsScanner";
import {padRight} from "../utils/common";
import {Plug} from "../utils/Plugin";
import {combiner} from "../utils/combiner";
import {SourceFile, Import} from "../utils/SourceFile";

const superHeader = `
(function () { 
var __packerCache = [];
function require(id) {
    var m = __packerCache[id];
    if (m.inited) return m.exports;
    m.inited = true;
    m.executor(require, m, m.exports);
    return m.exports;
}

function __packer(mId, executor) {
    __packerCache[mId] = {id: mId, inited: false, exports: {}, executor: executor};
}
var process = {
    env: {
        NODE_ENV: ''
    }
};
var global = window;\n`;


export function combineJS(outfile: string) {
    return plugin('combineJS', async (plug: Plug) => {
        console.time('JSScanner');
        const jsScanner = new JSScanner(plug);
        for (let i = 0; i < plug.jsEntries.length; i++) {
            const file = plug.jsEntries[i];
            await jsScanner.scan(file);
        }
        console.timeEnd('JSScanner');

        const numberHash = new Map<SourceFile, number>();
        let num = 0;

        function numberImports(file: SourceFile) {
            if (numberHash.has(file)) {
                return;
            }
            numberHash.set(file, num++);
            if (file.imports) {
                for (let i = 0; i < file.imports.length; i++) {
                    const imprt = file.imports[i];
                    numberImports(imprt.file);
                }
            }
        }

        function replaceImportsWithoutChangeLength(imports: Import[], code: string) {
            if (imports) {
                for (let i = 0; i < imports.length; i++) {
                    const imprt = imports[i];
                    const len = imprt.endPos - imprt.startPos;
                    // todo: check min len
                    code = code.substr(0, imprt.startPos) + padRight(numberHash.get(imprt.file), len) + code.substr(imprt.endPos);
                }
            }
            return code;
        }

        let superFooter = '';
        for (let i = 0; i < plug.jsEntries.length; i++) {
            const file = plug.jsEntries[i];
            numberImports(file);
            superFooter = `\nrequire(${numberHash.get(file)});`;
        }
        superFooter += '\n})()';

        const files = [...numberHash.keys()];
        const hasUpdates = files.some(file => file.extName === 'js' && file.updated);
        if (hasUpdates) {
            await combiner({
                type: 'js',
                plug,
                outfile,
                files,
                superHeader,

                getHeader: file => `__packer(${numberHash.get(file)}, function(require, module, exports) \{\n`,
                getContent: file => file.extName === 'js' ? replaceImportsWithoutChangeLength(file.imports, file.contentString) : '/* no js module */',
                getFooter: file => '\n});\n',

                superFooter,
            });
        }
    });
}