import {plugin, Plug} from "../packer";
import {SourceMapWriter, SourceMap} from "../utils/sourcemaps";
import * as path from "path";

Plug; //don't remove, else Plug will be removed from import, and d.ts doesn't compile

export function combineCSS(outfile: string) {
    return plugin('combineCSS', async plug => {

        let bulk = '';
        outfile = plug.normalizeDestName(outfile);
        const dirname = path.dirname(outfile);

        const smw = new SourceMapWriter();
        // files.sort((a, b) => a.numberName < b.numberName ? -1 : 1);
        const files = plug.getGeneratedFiles().filter(file => file.ext === 'css' && file.fullName !== outfile);
        const hasUpdated = files.some(file => file.updated);
        if (!hasUpdated) {
            return;
        }

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            let content = file.contentString;
            const match = content.match(/^\/\/[#@]\s+sourceMappingURL=(.*?)$/m);
            if (match) {
                //todo: if inlined base64?
                file.sourcemapFile = await plug.addFileFromFS(file.dirname + '/' + match[1]);
                content = content.replace(/^\/*\s*[#@]\s+sourceMappingURL=.*$/mg, '');
            }
            const footer = '\n';
            bulk += file.content + footer;
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

        const sourceMap = smw.toSourceMap();
        const mapFile = plug.addDistFile(outfile + '.map', sourceMap.toString());
        bulk += '\n/*# sourceMappingURL=' + mapFile.basename + '*/';

        plug.addDistFile(outfile, bulk);
    });
}