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
            callback(null, file.content);
        }, (err) => {
            callback(err, null);
        })
    };

    private isFile = (filename: string, callback: (err: any, result: boolean) => void) => {
        this.plug.isFileExists(filename).then(result => {
            callback(null, result);
        });
    };

    private scanned: any = {};

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

            const file = this.plug.getFileFromCache(moduleResolvedUrl);
            const distFile = this.plug.addDistFile(file.fullName, file.content, file);
            imprt.file = distFile;
            newImports.push(imprt);
            await this.scan(distFile, file.dirname);
        }
        file.imports = newImports;
    }
}
