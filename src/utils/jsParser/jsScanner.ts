import {parseJS} from "./jsParser";
import {Plugin} from "../Plugin";
import {SourceFile, Import} from "../SourceFile";
import {logger} from "../logger";
import {SourceError} from "../SourceError";
import {resolve} from "./requireResolve";
import {makeHash} from "../makeHash";


export class JSScanner {
    constructor(private plug: Plugin) {

    }

    private isRequire(code: string, start: number, size: number, startSymbolCode: number) {
        return size === 7 && startSymbolCode === 114/*r*/ && code.substr(start, size) === 'require';
    }

    private scanned = new Map<SourceFile, boolean>();

    private findImports(filename: string, code: string) {
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
                    if (code[r[i + 5] + 1] === ')') {
                        const startPos = r[i + 4] - 1;
                        const endPos = r[i + 5] + 1;
                        // const startLineCol = getLineCol(code, startPos);
                        // const endLineCol = getLineCol(code, endPos);
                        imports.push({
                            file: null,
                            startPos,
                            endPos,
                            startLine: 0,//startLineCol.line,
                            startColumn: 0,//startLineCol.col,
                            endLine: 0,//endLineCol.line,
                            endColumn: 0,//endLineCol.col,
                            module: this.replaceAliases(code.substring(r[i + 4], r[i + 5]))
                        });
                    }
                    else {
                        logger.warning(`Incorrect ${code.substring(r[i + 4] - 9, r[i + 5] + 2)} in ${filename}`);
                    }
                }
            }
        }
        return imports;
    }

    private replaceAliases(module: string) {
        if (this.plug.options.alias) {
            return this.plug.options.alias[module] || module;
        }
        return module;
    }

    async scan(file: SourceFile) {
        if (this.scanned.has(file)) {
            return;
        }
        this.scanned.set(file, true);
        if (!file.updated) {
            this.plug.stage.addFile(file);
            if (file.imports) {
                for (let i = 0; i < file.imports.length; i++) {
                    const imprt = file.imports[i];
                    await this.scan(imprt.file);
                }
            }
            return;
        }

        let code = await this.plug.fs.readContent(file);
        const filename = this.plug.fs.relativeName(file);
        const imports = this.findImports(filename, code);

        const newImports: Import[] = [];
        for (let i = 0; i < imports.length; i++) {
            const imprt = imports[i];
            let moduleResolvedUrl = await resolve(imprt.module, file.dirName, this.plug);
            if (moduleResolvedUrl === '%skip%') {
                const tmpFile = this.plug.fs.createGeneratedFile('tmp_' + makeHash(imprt.module) + '.js', '/*skipped file*/\nmodule.exports = {}', file);
                moduleResolvedUrl = tmpFile.fullName;
            }
            const imfile = this.plug.fs.getFromCache(moduleResolvedUrl);
            if (!moduleResolvedUrl || !imfile) {
                throw new SourceError(`Cannot find module "${moduleResolvedUrl || imprt.module}"`, file, imprt.startLine, imprt.startColumn, imprt.endColumn, imprt.endColumn);
            }
            imprt.file = imfile;
            newImports.push(imprt);

            // console.log('child scan', imprt.file.updated, imprt.file.extName, imprt.file.fullName);
            if (imprt.file.extName === 'js') {
                await this.scan(imprt.file);
            } else {
                this.plug.stage.addFile(imprt.file);
            }
        }
        file.imports = newImports;
    }
}
