import {SourceMapWriter, extractSourceMapAndRemoveItFromFile, parseSourceMapJSON} from "./sourcemaps";
import * as path from "path";
import {Plug} from "./Plugin";
import {SourceFile} from "./SourceFile";

interface CombinerOptions {
    plug: Plug;
    files: SourceFile[];
    outfile: string;
    superHeader?: string;
    superFooter?: string;
    getHeader?: (file: SourceFile) => string;
    getContent: (file: SourceFile) => string;
    getFooter?: (file: SourceFile) => string;
}

export async function combiner(params: CombinerOptions) {
    const {plug, superHeader, superFooter, getContent, getFooter, getHeader, files, outfile} = params;
    let bulk = params.superHeader;
    const outfile2 = params.plug.normalizeDestName(outfile);
    const dirname = path.dirname(outfile2);

    const smw = new SourceMapWriter();
    smw.skipCode(superHeader);

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        let {content, sourceFileName, sourceFileContent} = extractSourceMapAndRemoveItFromFile(getContent(file));
        let sourceMapFile: SourceFile;
        if (sourceFileName) {
            sourceMapFile = await plug.fs.read(sourceFileName);
            sourceFileContent = sourceMapFile.contentString;
        }
        const sourceMap = sourceFileContent ? parseSourceMapJSON(file.relativeName, sourceFileContent) : null;
        const header = getHeader ? getHeader(file) : '';
        const footer = getHeader ? getFooter(file) : '';
        bulk += header + content + footer;
        smw.skipCode(header);

        if (sourceMap) {
            let sourceMapDir = sourceMapFile ? sourceMapFile.dirName : file.dirName;
            const realSources = sourceMap.sources.map(filename => path.normalize(sourceMapDir + sourceMap.sourceRoot + filename));
            sourceMap.sources = realSources.map(filename => path.relative(dirname, filename));
            sourceMap.sourcesContent = [];
            for (let j = 0; j < realSources.length; j++) {
                const filename = realSources[j];
                const file = await plug.fs.read(filename);
                sourceMap.sourcesContent.push(file.contentString);
            }
            smw.putExistSourceMap(sourceMap);
            if (sourceMapFile && sourceMapFile.isGenerated) {
                sourceMapFile.updated = false;
            }
        } else {
            smw.putFile(content, file.relativeName);
        }

        smw.skipCode(footer);
        if (file.isGenerated) {
            file.updated = false;
        }
    }

    bulk += superFooter;
    smw.skipCode(superFooter);

    const sourceMap = smw.toSourceMap();
    const mapFile = plug.fs.createGeneratedFile(outfile2 + '.map', sourceMap.toString());
    bulk += '\n/*# sourceMappingURL=' + mapFile.getBasename() + '*/';

    plug.fs.createGeneratedFile(outfile2, bulk);
}