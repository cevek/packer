import "../helpers";
import {plugin, PackerResult} from "../packer";
import {Plugin} from "../utils/Plugin";
import {logger} from "../utils/logger";
import {SourceFile} from "../utils/SourceFile";
import {makeHash} from "../utils/makeHash";
import {relative} from "path";

import path = require('path');

export interface HTMLRenderData {
    htmlFileContent: string;
    params: HTMLReplaceParams;
    urlReplacedParams: HTMLReplaceParams;
}
const pluginMap = new Map<Plugin, HTMLRenderData>();

export interface HTMLReplaceParams {
    [key: string]: string | number;
}
export interface HTMLOptions {
    file: string,
    destFile: string,
    params: HTMLReplaceParams;
}

interface HTMLCache {
    urlData: Map<SourceFile, string>;
}

export function html(options: HTMLOptions) {
    return plugin('html', async(plug: Plugin) => {
        const files = await plug.fs.findFiles(options.file);
        files.forEach(file => {
            plug.stage.addFile(file);
            plug.fs.watch(file);
        });
        files.forEach(file => {
            if (file.imports) {
                const someImportsUpdated = file.imports.some(imprt => imprt.file.updated);
                if (someImportsUpdated) {
                    file.updated = true;
                }
            }
        });
        const updatedFiles = files.filter(file => file.updated);
        for (let i = 0; i < updatedFiles.length; i++) {
            const file = updatedFiles[i];
            const newSource = await replace(file, options.params, plug);
            const destFilename = plug.normalizeDestName(options.destFile);
            const destFile = plug.fs.createGeneratedFile(destFilename, newSource, file);
            destFile.nameCanBeHashed = false;
            plug.stage.addFile(destFile);
        }

        const nonUpdatedFiles = files.filter(file => !file.updated);
        for (let i = 0; i < nonUpdatedFiles.length; i++) {
            const file = nonUpdatedFiles[i];
            file.createdFiles.forEach(f => plug.stage.addFile(f));
        }
    });
}


export function renderHTML(packerResult: PackerResult, overrideParams: HTMLReplaceParams) {
    const cssFiles = packerResult.emittedCSSFiles;
    const jsFiles = packerResult.emittedJSFiles;
    const plug = packerResult.plugin;
    const renderData = pluginMap.get(plug);
    const params = Object.assign(renderData.params, overrideParams);
    return renderData.htmlFileContent.replace(/%(.*?)%/g, (m: string, m1: string) => {
        let urlM: RegExpMatchArray;
        if (urlM = m1.match(/url\(\s*['"]?(.*?)['"]?\s*\)/i)) {
            const url = urlM[1];
            return renderData.urlReplacedParams[url] as string;
        } else if (m1 === 'js') {
            let out = '\n';
            for (let i = 0; i < jsFiles.length; i++) {
                const filename = jsFiles[i];
                const src = plug.options.publicPath + relative(plug.options.dest, filename);
                out += `\t<script src="${src}"></script>\n`;
            }
            return out;
        } else if (m1 === 'css') {
            let out = '\n';
            for (let i = 0; i < cssFiles.length; i++) {
                const filename = cssFiles[i];
                const src = plug.options.publicPath + relative(plug.options.dest, filename);
                out += `\t<link rel="stylesheet" href="${src}">\n`;
            }
            return out;
        }
        let out = params[m1] as string;
        if (out == null) {
            logger.warning(`html plugin: ${m1} param is ${out}`);
            out = '';
        }
        return out;
    });
}

async function replace(htmlFile: SourceFile, replaceParams: HTMLReplaceParams, plug: Plugin) {
    const source = await plug.fs.readContent(htmlFile);
    const cache = plug.getCache('html') as HTMLCache;
    if (!cache.urlData) {
        cache.urlData = new Map();
    }
    const renderData: HTMLRenderData = {
        params: replaceParams,
        urlReplacedParams: {},
        htmlFileContent: source,
    };
    pluginMap.set(plug, renderData);
    const stage = plug.stage.list();
    return source.replace(/%(.*?)%/g, (m: string, m1: string) => {
        let urlM: RegExpMatchArray;
        if (urlM = m1.match(/url\(\s*['"]?(.*?)['"]?\s*\)/i)) {
            const url = urlM[1];
            const filename = plug.normalizeName(url);
            const urlFile = plug.fs.tryFileSync(filename);
            if (!urlFile) {
                logger.warning(`Cannot find ${filename} in ${htmlFile.fullName}`);
            }
            let newUrl = cache.urlData.get(urlFile);
            if (!newUrl || urlFile.updated) {
                const urlContent = plug.fs.readContentSync(urlFile);
                const urlBasename = (makeHash(urlFile.fullName) + makeHash(urlContent)).toString(33) + '.' + urlFile.extName;
                const urlDestFileName = plug.normalizeDestName(urlBasename);
                const urlDestFile = plug.fs.createGeneratedFile(urlDestFileName, urlContent, htmlFile);
                plug.stage.addFile(urlDestFile);
                urlDestFile.nameCanBeHashed = false;
                if (!htmlFile.imports) {
                    htmlFile.imports = [];
                }
                htmlFile.imports.push({
                    module: url,
                    file: urlFile,
                    startLine: null,
                    startColumn: null,
                    endLine: null,
                    endColumn: null,
                    startPos: null,
                    endPos: null,
                });
                newUrl = plug.options.publicPath + plug.relativeToDest(urlDestFile);
                cache.urlData.set(urlFile, newUrl);
                renderData.urlReplacedParams[url] = newUrl;
            }
            return newUrl;
        } else if (m1 === 'js') {
            let out = '\n';
            for (let i = 0; i < stage.length; i++) {
                const file = stage[i];
                if (file.extName == 'js' && plug.inDestFolder(file)) {
                    const src = plug.options.publicPath + plug.relativeToDest(file);
                    out += `\t<script src="${src}"></script>\n`;
                }
            }
            return out;
        } else if (m1 === 'css') {
            let out = '\n';
            for (let i = 0; i < stage.length; i++) {
                const file = stage[i];
                if (file.extName == 'css' && plug.inDestFolder(file)) {
                    const src = plug.options.publicPath + plug.relativeToDest(file);
                    out += `\t<link rel="stylesheet" href="${src}">\n`;
                }
            }
            return out;
        }
        let out = replaceParams[m1] as string;
        if (out == null) {
            logger.warning(`html plugin: ${m1} param is ${out}`);
            out = '';
        }
        return out;
    });
}
