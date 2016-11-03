import {plugin, Plug} from '../packer';
import {JSScanner} from '../utils/jsParser/jsScanner';
import {FileItem, Import} from '../utils/FileItem';
import {padRight} from '../utils/common';
import {SourceMapWriter, SourceMap} from '../utils/sourcemaps';
import * as path from 'path';

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
    return plugin('combineJS', async plug => {
        const jsScanner = new JSScanner(plug);
        for (let i = 0; i < plug.jsEntries.length; i++) {
            const file = plug.jsEntries[i];
            await jsScanner.scan(file, file.dirname);
        }
        // console.log(plug.getGeneratedFiles().filter(file => file.relativeName));

        const numberHash = new Map<FileItem, number>();
        let num = 0;
        
        function numbers(file: FileItem) {
            if (numberHash.has(file)) {
                return;
            }
            numberHash.set(file, num++);
            if (file.imports) {
                for (let i = 0; i < file.imports.length; i++) {
                    const imprt = file.imports[i];
                    numbers(imprt.file);
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
            numbers(file);
            superFooter = `\nrequire(${numberHash.get(file)});`;
        }
        superFooter += '\n})()';
        
        let bulk = superHeader;
        outfile = plug.normalizeDestName(outfile);
        const dirname = path.dirname(outfile);
        
        const smw = new SourceMapWriter();
        // files.sort((a, b) => a.numberName < b.numberName ? -1 : 1);
        
        smw.skipCode(superHeader);
        for (let [file, num] of numberHash) {
            //todo:
            let content = file.ext !== 'js' ? '/* no js module */' : file.contentString;

            const match = content.match(/^\/\/[#@]\s+sourceMappingURL=(.*?)$/m);
            if (match) {
                //todo: if inlined base64?
                file.sourcemapFile = await plug.addFileFromFS(file.dirname + '/' + match[1]);
                content = content.replace(/^\/\/[#@]\s+sourceMappingURL=.*$/mg, '');
            }
            const header = `__packer(${num}, function(require, module, exports) \{\n`;
            const footer = '\n});\n';
            bulk += header + replaceImportsWithoutChangeLength(file.imports, content) + footer;
            smw.skipCode(header);
            
            if (file.sourcemapFile) {
                const smFile = file.sourcemapFile;
                const sm = JSON.parse(smFile.contentString) as SourceMap;
                const realSources = sm.sources.map(filename => path.normalize(smFile.dirname + sm.sourceRoot + filename));
                sm.sources = realSources.map(filename => path.relative(dirname, filename));
                sm.sourcesContent = [];
                for (let j = 0; j < realSources.length; j++) {
                    const filename = realSources[j];
                    const file = await plug.addFileFromFS(filename);
                    sm.sourcesContent.push(file.contentString);
                }
                
                smw.putExistSourceMap(sm);
                if (!smFile.fromFileSystem) {
                    //todo: maybe method?
                    smFile.updated = false;
                }
            } else {
                smw.putFile(content, file.originals.length ? file.originals[0].relativeName : file.relativeName);
            }
            
            smw.skipCode(footer);
            if (!file.fromFileSystem) {
                //todo:
                file.updated = false;
            }
        }
        
        bulk += superFooter;
        smw.skipCode(superFooter);
        
        
        const sourceMap = smw.toSourceMap();
        const mapFile = plug.addDistFile(outfile + '.map', sourceMap.toString());
        bulk += '\n//# sourceMappingURL=' + mapFile.basename;
        
        plug.addDistFile(outfile, bulk);
    });
}