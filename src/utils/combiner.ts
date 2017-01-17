import {SourceMapWriter, extractSourceMapAndRemoveItFromFile, parseSourceMapJSON} from "./sourcemaps";
import * as path from "path";
import {Plugin} from "./Plugin";
import {SourceFile} from "./SourceFile";

export interface CombinerOptions {
    type: 'js' | 'css',
    plug: Plugin;
    files: SourceFile[];
    outfile: string;
    superHeader: string;
    superFooter: string;
    getHeader?: (file: SourceFile) => string;
    getContent: (file: SourceFile) => Promise<string>;
    getFooter?: (file: SourceFile) => string;
}

export async function combiner(params: CombinerOptions) {
    const {plug, superHeader, superFooter, getContent, getFooter, getHeader, files, outfile, type} = params;
    let bulk = params.superHeader;
    const dirname = path.dirname(outfile);
    const compileSourceMaps = plug.options.sourceMap;

    const smw = new SourceMapWriter();
    if (compileSourceMaps) {
        smw.skipCode(superHeader);
    }

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const header = getHeader ? getHeader(file) : '';
        let content = await getContent(file);
        const footer = getFooter ? getFooter(file) : '';

        if (compileSourceMaps) {
            let {content: fixedContent, sourceFileName, sourceFileContent} = extractSourceMapAndRemoveItFromFile(content);
            content = fixedContent;
            let sourceMapFile: SourceFile;
            if (sourceFileName) {
                sourceMapFile = plug.fs.findOrCreate(file.dirName + '/' + sourceFileName);
                sourceFileContent = await plug.fs.readContent(sourceMapFile);
            }
            const sourceMap = sourceFileContent ? parseSourceMapJSON(plug.fs.relativeName(file), sourceFileContent) : null;
            smw.skipCode(header);

            if (sourceMap) {
                let sourceMapDir = (sourceMapFile ? sourceMapFile.dirName : file.dirName) + '/' + (sourceMap.sourceRoot || '');
                const realSources = sourceMap.sources.map(filename => path.normalize(sourceMapDir + filename));
                sourceMap.sources = realSources.map(filename => path.relative(dirname, filename));
                sourceMap.sourcesContent = [];
                for (let j = 0; j < realSources.length; j++) {
                    const filename = realSources[j];
                    const file = plug.fs.findOrCreate(filename);
                    const originContent = await plug.fs.readContent(file);
                    sourceMap.sourcesContent.push(originContent);
                }
                smw.putExistSourceMap(content, sourceMap);
                if (sourceMapFile && sourceMapFile.isGenerated) {
                    sourceMapFile.updated = false;
                }
            } else {
                smw.putFile(content, plug.fs.relativeName(file));
            }
            smw.skipCode(footer);
            if (sourceMapFile) {
                plug.fs.stage.remove(sourceMapFile);
            }
        }
        plug.fs.stage.remove(file);
        bulk += header + content + footer;
    }

    bulk += superFooter;
    if (compileSourceMaps) {
        smw.skipCode(superFooter);
        const sourceMap = smw.toSourceMap();
        const mapFile = plug.fs.createGeneratedFile(outfile + '.map', sourceMap.toString(), files[0]);
        plug.fs.stage.addFile(mapFile);
        if (type == 'js') {
            bulk += '\n//# sourceMappingURL=' + mapFile.getBasename();
        }
        if (type == 'css') {
            bulk += '\n/*# sourceMappingURL=' + mapFile.getBasename() + '*/';
        }
    }
    const file = plug.fs.createGeneratedFile(outfile, bulk, files[0]);
    plug.fs.stage.addFile(file);
}