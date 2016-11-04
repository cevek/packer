import * as TS from "typescript";
import * as path from "path";
import {logger} from "../utils/logger";
import {plugin, Plug} from "../packer";
import {FileItem} from "../utils/FileItem";

interface Cache {
    program: TS.Program;
    oldConfigFile: FileItem;
    configParseResult: TS.ParsedCommandLine;
    compilerOptions: TS.CompilerOptions;
    compilerHost: TS.CompilerHost;
}


const redForegroundEscapeSequence = "\u001b[91m";
const yellowForegroundEscapeSequence = "\u001b[93m";
const blueForegroundEscapeSequence = "\u001b[93m";
const gutterStyleSequence = "\u001b[100;30m";
const gutterSeparator = " ";
const resetEscapeSequence = "\u001b[0m";
const ellipsis = "...";
const categoryFormatMap = {
    [TS.DiagnosticCategory.Warning]: yellowForegroundEscapeSequence,
    [TS.DiagnosticCategory.Error]: redForegroundEscapeSequence,
    [TS.DiagnosticCategory.Message]: blueForegroundEscapeSequence,
};


function formatAndReset(text: string, formatStyle: string) {
    return formatStyle + text + resetEscapeSequence;
}


function reportDiagnostics(plug: Plug, diagnostics: TS.Diagnostic[], host: TS.FormatDiagnosticsHost): void {
    for (const diagnostic of diagnostics) {
        reportDiagnosticWithColorAndContext(plug, diagnostic, host);
    }
}


function reportDiagnosticWithColorAndContext(plug: Plug, diagnostic: TS.Diagnostic, host: TS.FormatDiagnosticsHost): void {
    let output = "";

    if (diagnostic.file) {
        const {start, length, file} = diagnostic;
        const {line: firstLine, character: firstLineChar} = TS.getLineAndCharacterOfPosition(file, start);
        const {line: lastLine, character: lastLineChar} = TS.getLineAndCharacterOfPosition(file, start + length);
        const lastLineInFile = TS.getLineAndCharacterOfPosition(file, file.text.length).line;
        const pfile = plug.getFileFromCache(file.fileName);
        const relativeFileName = pfile.fullName;

        const hasMoreThanFiveLines = (lastLine - firstLine) >= 4;
        // let gutterWidth = (lastLine + 1 + "").length;
        if (hasMoreThanFiveLines) {
            // gutterWidth = Math.max(ellipsis.length, gutterWidth);
        }

        output += `${ relativeFileName }:${ firstLine + 1 }:${ firstLineChar + 1 } `;
        output += '\n';
        for (let i = firstLine; i <= lastLine; i++) {
            // If the error spans over 5 lines, we'll only show the first 2 and last 2 lines,
            // so we'll skip ahead to the second-to-last line.
            if (hasMoreThanFiveLines && firstLine + 1 < i && i < lastLine - 1) {
                // output += formatAndReset(padLeft(ellipsis, gutterWidth), gutterStyleSequence) + gutterSeparator + '\n';
                // i = lastLine - 1;
            }

            const lineStart = TS.getPositionOfLineAndCharacter(file, i, 0);
            const lineEnd = i < lastLineInFile ? TS.getPositionOfLineAndCharacter(file, i + 1, 0) : file.text.length;
            let lineContent = file.text.slice(lineStart, lineEnd);
            lineContent = lineContent.replace(/\s+$/g, "");  // trim from end
            lineContent = lineContent.replace("\t", " ");    // convert tabs to single spaces

            // Output the gutter and the actual contents of the line.
            // output += formatAndReset(padLeft(i + 1 + "", gutterWidth), gutterStyleSequence) + gutterSeparator;
            output += lineContent + '\n';

            // Output the gutter and the error span for the line using tildes.
            // output += formatAndReset(padLeft("", gutterWidth), gutterStyleSequence) + gutterSeparator;
            output += redForegroundEscapeSequence;
            if (i === firstLine) {
                // If we're on the last line, then limit it to the last character of the last line.
                // Otherwise, we'll just squiggle the rest of the line, giving 'slice' no end position.
                const lastCharForLine = i === lastLine ? lastLineChar : undefined;

                output += lineContent.slice(0, firstLineChar).replace(/\S/g, " ");
                output += lineContent.slice(firstLineChar, lastCharForLine).replace(/./g, "~");
            }
            else if (i === lastLine) {
                output += lineContent.slice(0, lastLineChar).replace(/./g, "~");
            }
            else {
                // Squiggle the entire line.
                output += lineContent.replace(/./g, "~");
            }
            output += resetEscapeSequence;

            output += '';
        }

        // output += '\n';
    }

    const categoryColor = categoryFormatMap[diagnostic.category];
    const category = TS.DiagnosticCategory[diagnostic.category];
    output += `\n${ formatAndReset(category, categoryColor) }: ${ TS.flattenDiagnosticMessageText(diagnostic.messageText, '\n') }`;
    output += '\n\n\n';
    logger.log(output);
}

//todo: if tsconfig.json is editing do not throw error
export function ts(options: TS.CompilerOptions = {}) {
    return plugin('ts', async plug => {
        //todo: use plug fs methods
        const cache = plug.getCache('ts') as Cache;

        options.outDir = plug.options.dest;
        options.sourceMap = true;
        options.inlineSourceMap = false;

        const configFileName = (options && options.project) || TS.findConfigFile(plug.options.context, TS.sys.fileExists);
        const configFile = await plug.addFileFromFS(configFileName);

        if (!cache.program || cache.oldConfigFile !== configFile || configFile.updated) {
            cache.oldConfigFile = configFile;
            logger.info('Using TypeScript v' + TS.version + ' and ' + configFile.relativeName);
            const result = TS.parseConfigFileTextToJson(configFileName, configFile.contentString);
            const configObject = result.config;
            if (!configObject) {
                reportDiagnostics(plug, [result.error], /* compilerHost */ undefined);
                throw new Error('Error in tsconfig.json');
            }
            cache.configParseResult = TS.parseJsonConfigFileContent(configObject, TS.sys, path.dirname(configFile.fullName), options, configFile.fullName);
            if (cache.configParseResult.errors.length > 0) {
                reportDiagnostics(plug, cache.configParseResult.errors, /* compilerHost */ undefined);
                throw new Error('Error in tsconfig.json');
            }
            cache.compilerOptions = cache.configParseResult.options;

            cache.compilerHost = TS.createCompilerHost(cache.compilerOptions);
            const hostGetSourceFile = cache.compilerHost.getSourceFile;
            cache.compilerHost.getSourceFile = function (fileName: string, languageVersion: TS.ScriptTarget, onError?: (message: string) => void) {
                const file = plug.getFileFromCache(fileName);
                // console.log('getSourceFile', fileName);
                // Return existing SourceFile object if one is available
                if (cache.program && file && !file.updated) {
                    const sourceFile = cache.program.getSourceFile(fileName);
                    // console.log('getSourceFile from program', sourceFile.fileName, sourceFile.path);
                    if (sourceFile && sourceFile.path) {
                        return sourceFile;
                    }
                }
                // Use default host function
                return hostGetSourceFile(fileName, languageVersion, onError);
            };

            cache.compilerHost.fileExists = function (filename: string) {
                return plug.isFileExistsSync(filename);
            };

            cache.compilerHost.directoryExists = function (filename: string) {
                return plug.dirExistsSync(filename);
            };

            cache.compilerHost.writeFile = (file, data) => {
                // console.log('put', file);

                const dist = plug.addDistFile(file, data);
                //console.log(dist.fullName);

            };
        }
        const program = TS.createProgram(cache.configParseResult.fileNames, cache.compilerOptions, cache.compilerHost);
        // First get and report any syntactic errors.
        let diagnostics = program.getSyntacticDiagnostics();
        program.getSourceFiles().forEach(file =>
            plug.addFileFromFSSync(file.fileName));

        // If we didn't have any syntactic errors, then also try getting the global and
        // semantic errors.
        if (diagnostics.length === 0) {
            diagnostics = program.getOptionsDiagnostics().concat(program.getGlobalDiagnostics());
            if (diagnostics.length === 0) {
                diagnostics = program.getSemanticDiagnostics();
            }
        }
        // Otherwise, emit and report any errors we ran into.
        const emitOutput = program.emit();
        diagnostics = diagnostics.concat(emitOutput.diagnostics);
        if (diagnostics.length) {
            reportDiagnostics(plug, (TS as any).sortAndDeduplicateDiagnostics(diagnostics), cache.compilerHost);
        }
        cache.program = program;
    });
}