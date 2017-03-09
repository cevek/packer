import {plugin} from "../packer";
import {JSScanner} from "../utils/jsParser/jsScanner";
import {padRight} from "../utils/common";
import {Plugin} from "../utils/Plugin";
import {combiner} from "../utils/combiner";
import {SourceFile, Import} from "../utils/SourceFile";
import {base64Url} from "../utils/base64Url";
import {makeHash, makeHashBinary} from "../utils/makeHash";
import * as path from "path";

const superFooter = `\n})(typeof window == 'object' ? window : process, typeof require != 'undefined' && require, typeof module != 'undefined' && module, typeof require != 'undefined' && require)`;

export interface CombineJSOptions {
    attrs?: {[attr: string]: string}
}

export function combineJS(entryFilename: string, outfile: string, options?: CombineJSOptions) {
    return plugin('combineJS', async (plug: Plugin) => {
        const superHeader = `

(function (global, rootRequire, rootModule, rootRequire) { 
var __packerCache = [];
function require(id) {
    var m = __packerCache[id];
    if (m.inited) return m.exports;
    m.inited = true;
    m.executor(require, m, m.exports);
    return m.exports;
}
require.publicPath = "${plug.options.publicPath}";

function __packer(mId, executor) {
    __packerCache[mId] = {id: mId, inited: false, exports: {}, executor: executor};
}
var process = {
    env: {
        NODE_ENV: ${JSON.stringify(process.env.NODE_ENV)}
    }    
};
`;
        // console.time('JSScanner');
        outfile = plug.normalizeDestName(outfile);

        const jsScanner = new JSScanner(plug);
        entryFilename = plug.fs.normalizeName(entryFilename);
        const entryFile = plug.fs.getFromCache(entryFilename);
        if (!entryFile) {
            plug.printAllGeneratedFiles();
            throw new Error(`entryFilename ${entryFilename} doesn't exists`);
        }
        // plug.jsEntries.push(entryFile);
        // console.timeEnd('JSScanner');

        const numberHash = new Map<SourceFile, number>();
        let num = 0;

        async function numberImports(file: SourceFile) {
            await jsScanner.scan(file);
            if (numberHash.has(file)) {
                return;
            }
            numberHash.set(file, num++);
            if (file.imports) {
                for (let i = 0; i < file.imports.length; i++) {
                    const imprt = file.imports[i];
                    await numberImports(imprt.file);
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
                        throw new Error('num ' + num + ' is not correct for file '+ plug.fs.relativeName(imprt.file));
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

        async function nonJsFileContent(file: SourceFile) {
            const content = await plug.fs.readContent(file);
            const binaryContent = file.content;
            if (plug.options.maxInlineSize >= content.length) {
                return 'module.exports = "' + base64Url(file.extName, binaryContent) + '"';
            }
            const relativeName = (makeHash(file.fullName) + makeHashBinary(binaryContent)).toString(36) + '.' + file.extName;
            const destFileName = plug.normalizeDestName(relativeName);
            const destFile = await plug.fs.createGeneratedFromFile(destFileName, file, file);
            destFile.nameCanBeHashed = false;
            plug.fs.stage.addFile(destFile);
            return 'module.exports = require.publicPath + "' + path.relative(outfile, destFileName).replace(/..\//g, '') + '"';
        }

        let localSuperFooter = '';
        for (let file of plug.jsEntries) {
            await numberImports(file);
            localSuperFooter = `\nrequire(${numberHash.get(file)});`;
        }
        await numberImports(entryFile);
        localSuperFooter = `\nrootModule.exports = require(${numberHash.get(entryFile)});`;
        localSuperFooter += superFooter;

        const files = [...numberHash.keys()];

        files.forEach(file => {
            if (file.imports) {
                const someNoneJsImportsUpdated = file.imports.some(imprt => imprt.file.extName !== 'js' && imprt.file.updated);
                if (someNoneJsImportsUpdated) {
                    file.updated = true;
                }
            }
        });

        const hasUpdates = files.some(file => file.extName === 'js' && file.updated);
        let file: SourceFile;
        if (hasUpdates) {
            file = await combiner({
                type: 'js',
                plug,
                outfile,
                files,
                superHeader,

                getHeader: file => `__packer(${numberHash.get(file)}, function(require, module, exports) \{\n`,
                getContent: async file => file.extName === 'js'
                    ? replaceImportsWithoutChangeLength(file.imports, await plug.fs.readContent(file))
                    : await nonJsFileContent(file),
                getFooter: file => '\n});\n',

                superFooter: localSuperFooter,
            });
        } else {
            if (files.length) {
                files[0].createdFiles.forEach(f => {
                    plug.fs.stage.addFile(f)
                    file = f;
                });
            }
        }
        if (file) {
            if (!file.injectOptions) {
                file.injectOptions = {};
            }
            file.injectOptions.script = options;
        }
    });
}