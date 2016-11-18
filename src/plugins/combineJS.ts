import {plugin} from "../packer";
import {JSScanner} from "../utils/jsParser/jsScanner";
import {padRight} from "../utils/common";
import {Plugin} from "../utils/Plugin";
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


export function combineJS(entryFilename: string, outfile: string) {
    return plugin('combineJS', async (plug: Plugin) => {
        // console.time('JSScanner');
        const jsScanner = new JSScanner(plug);
        entryFilename = plug.fs.normalizeName(entryFilename);
        const entryFile = plug.fs.getFromCache(entryFilename);
        if (!entryFile) {
            plug.printAllGeneratedFiles();
            throw new Error(`entryFilename ${entryFilename} doesn't exists`);
        }
        plug.jsEntries.add(entryFile);
        // console.timeEnd('JSScanner');

        const numberHash = new Map<SourceFile, number>();
        let num = 0;

        async function numberImports(file: SourceFile) {
            // await jsScanner.scan(file);
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
                    const num = numberHash.get(imprt.file);
                    if (!Number.isFinite(num)) {
                        throw new Error('num is not correct: ' + num);
                    }
                    const replace = padRight(num, len);
                    const lenBefore = imprt.endPos - imprt.startPos;
                    if (lenBefore > replace.length) {
                        throw new Error(`Replace length is not correct: ${lenBefore} => ${replace.length}`);
                    }
                    code = code.substr(0, imprt.startPos) + replace + code.substr(imprt.endPos);
                }
            }
            return code;
        }

        let superFooter = '';
        for (let file of plug.jsEntries) {
            numberImports(file);
            superFooter += `\nrequire(${numberHash.get(file)});`;
        }
        superFooter += '\n})()';

        const files = [...numberHash.keys()];
        const hasUpdates = files.some(file => file.extName === 'js' && file.updated);
        if (hasUpdates) {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                await jsScanner.scan(file);
            }
            await combiner({
                type: 'js',
                plug,
                outfile,
                files,
                superHeader,

                getHeader: file => `__packer(${numberHash.get(file)}, function(require, module, exports) \{\n`,
                getContent: async file => file.extName === 'js' ? replaceImportsWithoutChangeLength(file.imports, await plug.fs.readContent(file)) : '/* no js module */',
                getFooter: file => '\n});\n',

                superFooter,
            });
        }
    });
}