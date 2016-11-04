import {parseJS} from "./jsParser";
import {promisify} from "../promisify";
import {Plug} from "../../packer";
import {FileItem, Import} from "../FileItem";
import {logger} from "../logger";
import * as path from "path";

const _resolve = promisify<string>(require('resolve'));

const nodeModuleRegExp = /^(?:\.\.?(?:\/|$)|\/|([A-Za-z]:)?[\\\/])/;

async function resolve(module: string, options: ResolveOptions, plug: Plug): Promise<string> {
    try {
        const res = await _resolve(module, options);
        // console.log(module, res);
        return res;

    } catch (e) {
        plug.printAllGeneratedFiles();
        // todo: common errors: filename register
        throw e;
    }
}

interface ResolveOptions {
    basedir?: string;
    package?: string;
    readFile?: (filename: string, callback: (err: any, data: Buffer) => void) => void;
    isFile?: (filename: string, callback: (err: any, data: boolean) => void) => void;
    moduleDirectory?: string;
}

export class JSScanner {
    constructor(private plug: Plug) {

    }

    private isRequire(code: string, start: number, size: number, startSymbolCode: number) {
        return size === 7 && startSymbolCode === 114/*r*/ && code.substr(start, size) === 'require';
    }

    private readFile = (filename: string, callback: (err: any, result: Buffer) => void): void => {
        this.plug.addFileFromFS(filename).then((file) => {
            // console.log('realReadFile', filename);
            callback(null, file.content);
        }, (err) => {
            callback(err, null);
        })
    };

    private isFile = (filename: string, callback: (err: any, result: boolean) => void) => {
        filename = this.plug.normalizeName(filename);

        //todo: optimize?
        if (filename.indexOf('/node_modules/') > -1 && filename.indexOf(this.plug.options.dest) === 0) {
            callback(null, false);
            return;
        }
        // const destRelFilename = path.relative(filename, this.plug.options.dest);
        this.plug.isFileExists(filename).then(result => {
            // console.log(filename, result);
            // callback(null, result);
            if (result) {
                callback(null, true);
            } else {
                // console.log(filename);
                // if file is not js we say yes, because we need extract it
                //todo: check for folder
                if (filename.match(/\./) && !filename.match(/\.js$/i) && !filename.match(/package\.json$/)) {
                    const origFilename = this.plug.options.context + '/' + path.relative(this.plug.options.dest, filename);
                    this.plug.addFileFromFS(origFilename).then(file => {
                        const dist = this.plug.addDistFile(file.fullName, file.content, file);
                        callback(null, true);
                    });
                } else {
                    callback(null, false);
                }
            }
        });
    };

    private scanned: any = {};
    private number = 0;

    private findImports(code: string) {
        const r = parseJS(code, this.isRequire);
        const len = r.length;
        let start = 0;
        let end = 0;
        const imports: Import[] = [];
        for (let i = 0; i < len; i += 3) {
            if (r[i] === 1 /*identifier*/) {
                start = r[i + 1];
                end = r[i + 2];
                // todo: check abc. require ("foo");
                if (end - start === 7 && code[start] === 'r' && code.substring(start, end) === 'require' && code[end] == '(' && code[start - 1] !== '.' && r[i + 3] === 2 /*string*/) {
                    imports.push({
                        file: null,
                        startPos: r[i + 4] - 1,
                        endPos: r[i + 5] + 1,
                        module: code.substring(r[i + 4], r[i + 5])
                    });
                }
            }
        }
        return imports;
    }

    async scan(file: FileItem, searchContext: string) {
        if (!file.updated || this.scanned[file.fullName]) {
            // this.plug.measureEnd('scan');
            return null;
        }
        // console.log(file.id, file.updated, file.fullName);
        // this.plug.measureStart('scan2');
        this.scanned[file.fullName] = true;
        // file.numberName = this.number++;
        // this.plug.numberedFiles.push(file);
        // console.log('scan', file.relativeName, file.numberName);
        // console.log('scan', file.id, file.fullName, file.numberName);
        let code = file.contentString;
        const imports = this.findImports(code);

        const newImports: Import[] = [];
        for (let i = 0; i < imports.length; i++) {
            const imprt = imports[i];
            const moduleResolvedUrl = await resolve(imprt.module, {
                basedir: searchContext,
                readFile: this.readFile,
                isFile: this.isFile
            }, this.plug);
            // console.log(moduleResolvedUrl);
            // const distFile = this.plug.addDistFile(imFile.fullName, imFile.content);
            /*
             else {
             const origFile = this.plug.options.context + '/' + path.relative(this.plug.options.dest, moduleResolvedUrl);
             console.log('origFile', origFile, moduleResolvedUrl);
             file = await this.plug.addFileFromFS(origFile);
             }
             */

            // let file = this.plug.getFileFromStage(moduleResolvedUrl);

            /*
             if (!file) {
             const origFile = this.plug.normalizeDestName(moduleResolvedUrl);
             console.log('orig', moduleResolvedUrl, origFile);

             const imFile = await this.plug.addFileFromFS(origFile);
             file = this.plug.addDistFile(imFile.fullName, imFile.content, imFile);
             }
             */

            // skip non js files
            // if (!moduleResolvedUrl.match(/\.js$/)) {
            //     const origFile = this.plug.options.context + '/' + path.relative(this.plug.options.dest, moduleResolvedUrl);
            //     const file = await this.plug.addFileFromFS(origFile);
            //     const distFile = this.plug.addDistFile(file.fullName, file.content, file);
                // console.log('non js', file.fullName, distFile.fullName, distFile.fromFileSystem);
                // console.log('skip', distFile.relativeName, distFile.fromFileSystem);
                // continue;
            // }

            let file: FileItem;
            if (moduleResolvedUrl.match(/\/node_modules\//)) {
                file = await this.plug.addFileFromFS(moduleResolvedUrl);
            } else {
                file = this.plug.getFileFromStage(moduleResolvedUrl);
            }

            const distFile = this.plug.addDistFile(file.fullName, file.content, file);
            imprt.file = distFile;
            newImports.push(imprt);
            await this.scan(distFile, file.dirname);
        }
        file.imports = newImports;
        // this.plug.measureEnd('scan2');

        /*return Promise
         .all(
         imports.map(imprt =>
         resolve(imprt.module, {
         basedir: file.dirname,
         readFile: this.readFile,
         isFile: this.isFile
         }).then(resolved => {
         imprt.file = this.plug.getFileByName(resolved);
         return imprt;
         }))
         )
         .then(() => {
         file.imports = imports.map(imprt => imprt.file);
         this.scanned[file.fullName] = true;
         const promises = imports.map(imprt => () => this.scan(imprt.file));
         return promises.reduce((p, fn) => p.then(fn), Promise.resolve()).then(() => {

         imports.forEach(imprt => {
         const len = imprt.endPos - imprt.startPos;
         // todo: check min len
         code = code.substr(0, imprt.startPos) + (pad + imprt.file.numberName).substr(-len) + code.substr(imprt.endPos);
         });
         file.setContent(code);
         });
         });*/
    }
}
