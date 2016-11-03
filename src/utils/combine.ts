/*
import {SourceMapWriter, SourceMap} from './sourcemaps';
import {Plug} from '../packer';
import {FileItem} from './FileItem';
import * as path from 'path';
import {padRight} from './common';

export async function combine(superHeaderFn: (entries: number[]) => string, superFooterFn: (entries: number[])=> string, outfile: string, plug: Plug, files: FileItem[], headerFn: (file: FileItem, n: number) => string, footerFn: (file: FileItem)=>string) {
    let bulk = superHeaderFn;
    outfile = plug.normalizeDestName(outfile);
    const dirname = path.dirname(outfile);
    
    const smw = new SourceMapWriter();
    // files.sort((a, b) => a.numberName < b.numberName ? -1 : 1);
    
    
    const superHeader = superHeaderFn();
    smw.skipCode(superHeader);
    
    const keys = Object.keys(numberHash);
    for (let i = 0; i < keys.length; i++) {
        const {num, file} = numberHash[keys[i]];
        const content = file.content.toString().replace(/^\/\/[#@]\s+sourceMappingURL=.*$/mg, '');
        const header = headerFn(file, num);
        const footer = footerFn(file);
        bulk += header + replaceImportsWithoutChangeLength(file) + footer;
        smw.skipCode(header);
        
        if (file.sourcemapFile) {
            const smFile = file.sourcemapFile;
            const sm = JSON.parse(smFile.content.toString()) as SourceMap;
            const realSources = sm.sources.map(filename => path.normalize(smFile.dirname + sm.sourceRoot + filename));
            sm.sources = realSources.map(filename => path.relative(dirname, filename));
            sm.sourcesContent = [];
            for (let j = 0; j < realSources.length; j++) {
                const filename = realSources[j];
                const file = await plug.addFileFromFS(filename);
                sm.sourcesContent.push(file.content.toString());
            }
            smw.putExistSourceMap(sm);
        } else {
            smw.putFile(content, file.originals.length ? file.originals[0].relativeName : file.relativeName);
        }
        
        smw.skipCode(footer);
        if (file.sourcemapFile) {
            plug.removeFile(file.sourcemapFile);
        }
        plug.removeFile(file);
    }
    
    
    bulk += superFooterFn;
    smw.skipCode(superFooterFn);
    const sourceMap = smw.toSourceMap();
    const mapFile = plug.addDistFile(outfile + '.map', sourceMap.toString());
    bulk += '\n//# sourceMappingURL=' + mapFile.basename;
    
    plug.addDistFile(outfile, bulk);
}


*/
