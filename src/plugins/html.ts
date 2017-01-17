import '../helpers';
import {plugin, PackerResult} from '../packer';
import {Plugin} from '../utils/Plugin';
import {logger} from '../utils/logger';
import {SourceFile} from '../utils/SourceFile';
import {makeHash, makeHashBinary} from '../utils/makeHash';
import {relative} from 'path';
const ejs = require('ejs');

import path = require('path');

export interface HTMLRenderData {
    template: (p: HTMLReplaceParams) => string;
    params: HTMLReplaceParams;
}

const pluginMap = new Map<Plugin, Map<string, HTMLRenderData>>();

export interface HTMLReplaceParams {
    [key: string]: any;
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
        const cache = plug.getCache('html') as HTMLCache;
        if (!cache.urlData) {
            cache.urlData = new Map();
        }

        let renderDataItems = pluginMap.get(plug);
        if (!renderDataItems) {
            renderDataItems = new Map();
            pluginMap.set(plug, renderDataItems);
        }

        files.forEach(file => {
            plug.fs.stage.addFile(file);
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
            let newSource = await replaceHref(file, plug, cache);
            const params = preparePredefinedParams(options.params, plug);
            const renderData: HTMLRenderData = {
                params: params,
                template: null
            };
            renderDataItems.set(file.fullName, renderData);
            renderData.template = ejs.compile(newSource, {compileDebug: true});
            newSource = renderData.template(params);
            const destFilename = plug.normalizeDestName(options.destFile);
            const destFile = plug.fs.createGeneratedFile(destFilename, newSource, file);
            destFile.nameCanBeHashed = false;
            plug.fs.stage.addFile(destFile);
        }

        const nonUpdatedFiles = files.filter(file => !file.updated);
        for (let i = 0; i < nonUpdatedFiles.length; i++) {
            const file = nonUpdatedFiles[i];
            file.createdFiles.forEach(f => plug.fs.stage.addFile(f));
        }
    });
}


function preparePredefinedParams(params: HTMLReplaceParams, plug: Plugin, packerResult?: PackerResult) {
    let cssFiles: SourceFile[] = [];
    let jsFiles: SourceFile[] = [];
    if (packerResult) {
        for (let i = 0; i < packerResult.emittedFiles.length; i++) {
            const file = packerResult.emittedFiles[i];
            if (file.extName === 'js') {
                jsFiles.push(file);
            } else if (file.extName === 'css') {
                cssFiles.push(file);
            }
        }
    } else {
        const stage = plug.fs.stage.list();
        cssFiles = [];
        jsFiles = [];
        for (let i = 0; i < stage.length; i++) {
            const file = stage[i];
            if ((file.extName === 'js' || file.extName === 'css') && plug.inDestFolder(file)) {
                if (file.extName === 'js') {
                    jsFiles.push(file);
                }
                else {
                    cssFiles.push(file);
                }
            }
        }
    }

    let js = '\n';
    for (let i = 0; i < jsFiles.length; i++) {
        const jsFile = jsFiles[i];
        const filename = jsFile.fullName;
        const src = plug.options.publicPath + relative(plug.options.dest, filename);
        const attrs = jsFile.injectOptions && jsFile.injectOptions.script ? makeAttrs(jsFile.injectOptions.script.attrs) : '';
        js += `\t<script src="${src}"${attrs}></script>\n`;
    }

    let css = '\n';
    for (let i = 0; i < cssFiles.length; i++) {
        const cssFile = cssFiles[i];
        const filename = cssFile.fullName;
        const src = plug.options.publicPath + relative(plug.options.dest, filename);
        const attrs = cssFile.injectOptions && cssFile.injectOptions.link ? makeAttrs(cssFile.injectOptions.link.attrs) : '';
        css += `\t<link rel="stylesheet" href="${src}"${attrs}>\n`;
    }

    params['js'] = js;
    params['css'] = css;
    return params;
}

function makeAttrs(attrs: {[attr: string]: string}) {
    if (!attrs) {
        return '';
    }
    let s = '';
    for (const attr in attrs){
        s += ` ${attr}="${attrs[attr]}"`;
    }
    return s;
}

export function renderHTML(filename: string, packerResult: PackerResult, overrideParams: HTMLReplaceParams) {
    const plug = packerResult.plugin;
    filename = plug.normalizeName(filename);
    const renderDataMap = pluginMap.get(plug);
    if (!renderDataMap) {
        throw new Error('No assigned html data for current results');
    }
    const renderData = renderDataMap.get(filename);
    if (!renderData) {
        throw new Error('No assigned html data for: ' + filename);
    }
    const params = preparePredefinedParams(Object.assign(renderData.params, overrideParams), plug, packerResult);
    return renderData.template(params);
}

async function replaceHref(htmlFile: SourceFile, plug: Plugin, cache: HTMLCache) {
    const source = await plug.fs.readContent(htmlFile);
    return source.replace(/ href=["']\s*(.*?)\s*["']/ig, (m: string, m1: string) => {
        const url = m1;
        if (/^https?:/i.test(m1)) {
            return m;
        }
        const filename = plug.normalizeName(url);
        const urlFile = plug.fs.tryFileSync(filename);
        if (!urlFile) {
            logger.warning(`Cannot find ${filename} in ${htmlFile.fullName}`);
            return m;
        }
        let newUrl = cache.urlData.get(urlFile);
        if (!newUrl || urlFile.updated) {
            plug.fs.readContentSync(urlFile);
            const urlBinaryContent = urlFile.content;
            const urlBasename = (makeHash(urlFile.fullName) + makeHashBinary(urlBinaryContent)).toString(36) + '.' + urlFile.extName;
            const urlDestFileName = plug.normalizeDestName(urlBasename);
            const urlDestFile = plug.fs.createGeneratedFile(urlDestFileName, urlBinaryContent, htmlFile);
            plug.fs.stage.addFile(urlDestFile);
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
        }
        return ' href="' + newUrl + '"';
    });
}
