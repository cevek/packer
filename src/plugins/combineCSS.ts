import {plugin} from '../packer';
import {Plugin} from '../utils/Plugin';
import {combiner} from '../utils/combiner';
import {SourceFile} from '../utils/SourceFile';
import {parseCSSUrl} from '../utils/parseCSSUrl';
import {base64Url} from '../utils/base64Url';
import {makeHash, makeHashBinary} from '../utils/makeHash';
import * as path from 'path';
import {logger} from '../utils/logger';
import {Glob} from '../utils/CachedFS';
import {globValue} from '../utils/globValue';


interface CombineCSSCache {
    urlData: Map<SourceFile, string>;
    linkOptions: Map<SourceFile, CombineCSSOptions>;
}

export interface CombineCSSOptions {
    attrs?: {[key: string]: string}
}

export function combineCSS(outfile: string, filterGlob: Glob = '**/*.css', options?: CombineCSSOptions) {
    return plugin('combineCSS', async (plug: Plugin) => {
        outfile = plug.normalizeDestName(outfile);
        const cache = plug.getCache('combineCSS') as CombineCSSCache;
        if (!cache.urlData) {
            cache.urlData = new Map();
        }


        const files = plug.fs.stage.list().filter(file => file.extName === 'css' && file.fullName !== outfile && (filterGlob ? globValue(file.fullName, filterGlob) : true));
        files.forEach(file => {
            if (file.imports) {
                const someImportsUpdated = file.imports.some(imprt => imprt.file.updated);
                if (someImportsUpdated) {
                    file.updated = true;
                }
            }
        });
        const hasUpdates = files.some(file => file.updated);
        // console.log(hasUpdates, files.length);
        async function replaceUrl(cssFile: SourceFile) {
            const content = await plug.fs.readContent(cssFile);
            const results = parseCSSUrl(content);
            let newContent = content;
            let offset = 0;
            for (let i = 0; i < results.length; i++) {
                const result = results[i];
                const url = (result.url);
                if (/^https?:/i.test(url) || /^data:/.test(url)) {
                    continue;
                }
                const abcUrl = plug.normalizeName(path.isAbsolute(url) ? plug.options.dest + url : path.resolve(cssFile.dirName, url));
                
                const urlFile = await plug.fs.tryFile(abcUrl);
                if (!urlFile) {
                    //todo:
                    logger.warning(`Cannot find url(${abcUrl}) in ${outfile}`);
                    continue;
                }
                let newUrl = cache.urlData.get(urlFile);
                if (urlFile.updated || !newUrl) {
                    const urlContent = await plug.fs.readContent(urlFile);
                    const urlContentBinary = urlFile.content;
                    if (plug.options.maxInlineSize >= urlContent.length) {
                        newUrl = base64Url(urlFile.extName, urlContentBinary);
                    } else {
                        const relativeName = (makeHash(urlFile.fullName) + makeHashBinary(urlContentBinary)).toString(36) + '.' + urlFile.extName;
                        const destFileName = plug.normalizeDestName(relativeName);
                        const destFile = await plug.fs.createGeneratedFromFile(destFileName, urlFile, cssFile);
                        plug.fs.stage.addFile(destFile);
                        destFile.nameCanBeHashed = false;
                        newUrl = plug.options.publicPath + path.relative(outfile, destFileName).replace(/^..\//, '');
                    }
                    if (!cssFile.imports) {
                        cssFile.imports = [];
                    }
                    cssFile.imports.push({
                        module: url,
                        file: urlFile,
                        startLine: null,
                        startColumn: null,
                        endLine: null,
                        endColumn: null,
                        startPos: null,
                        endPos: null,
                    });

                    newUrl = `url("${newUrl}")`;
                    cache.urlData.set(urlFile, newUrl);
                }

                newContent = newContent.substr(0, offset + result.start) + newUrl + newContent.substr(offset + result.end);
                offset += newUrl.length - (result.end - result.start);
            }
            return newContent;
        }
        let file: SourceFile;
        if (hasUpdates) {
            file = await combiner({
                type: 'css',
                plug,
                outfile,
                files,
                superHeader: '',
                getFooter: file => '\n',
                getContent: replaceUrl,
                superFooter: '',
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
            file.injectOptions.link = options;
        }
    });
}