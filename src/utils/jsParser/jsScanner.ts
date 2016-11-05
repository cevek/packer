import {parseJS} from "./jsParser";
import {promisify} from "../promisify";
import {Plug} from "../Plugin";
import {SourceFile, Import} from "../SourceFile";

const _resolve = promisify<string>(require('resolve'));

async function resolve(module: string, options: ResolveOptions, plug: Plug): Promise<string> {
    try {
        return await _resolve(module, options);
    } catch (e) {
        plug.fs.printAllGeneratedFiles();
        // todo: common errors: filename register
        throw e;
    }
}

interface ResolveOptions {
    basedir?: string;
    package?: string;
    readFile?: (filename: string, callback: (err: any, data: string | Buffer) => void) => void;
    isFile?: (filename: string, callback: (err: any, data: boolean) => void) => void;
    moduleDirectory?: string;
}

export class JSScanner {
    constructor(private plug: Plug) {

    }

    private isRequire(code: string, start: number, size: number, startSymbolCode: number) {
        return size === 7 && startSymbolCode === 114/*r*/ && code.substr(start, size) === 'require';
    }

    private readFile = (filename: string, callback: (err: any, result: string) => void): void => {
        this.plug.fs.read(filename).then((file) => {
            callback(null, file.contentString);
        }, (err) => {
            callback(err, null);
        })
    };

    private isFile = (filename: string, callback: (err: any, result: boolean) => void) => {
        this.plug.fs.tryFile(filename).then(file => {
            callback(null, file && file.stat.isFile);
        });
    };

    private scanned = new Map<SourceFile, boolean>();

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

    async scan(file: SourceFile) {
        if (!file.updated || this.scanned.has(file)) {
            return;
        }

        this.scanned.set(file, true);
        let code = file.contentString;
        const imports = this.findImports(code);

        const newImports: Import[] = [];
        for (let i = 0; i < imports.length; i++) {
            const imprt = imports[i];
            const moduleResolvedUrl = await resolve(imprt.module, {
                basedir: file.dirName,
                readFile: this.readFile,
                isFile: this.isFile
            }, this.plug);

            imprt.file = this.plug.fs.getFromCache(moduleResolvedUrl);
            this.plug.fs.readContent(imprt.file);
            imprt.file.isGenerated = true;
            newImports.push(imprt);
            // console.log('child scan', imprt.file.updated, imprt.file.extName, imprt.file.fullName);
            if (imprt.file.extName === 'js') {
                await this.scan(imprt.file);
            }
        }
        file.imports = newImports;
    }
}
