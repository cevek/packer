import * as TS from 'typescript';
import * as path from 'path';
import {logger} from '../utils/logger';
import {plugin, Plug} from '../packer';
import {FileItem} from '../utils/FileItem';

interface Cache {
    program: TS.Program;
    oldConfigFile: FileItem;
    configParseResult: TS.ParsedCommandLine;
    compilerOptions: TS.CompilerOptions;
    compilerHost: TS.CompilerHost;
}

export function ts(options: TS.CompilerOptions = {}) {
    return plugin('ts', async plug => {
        //todo: use plug fs methods
        const cache = plug.getCache('ts') as Cache;
        
        options.outDir = plug.options.dest;
        options.sourceMap = true;
        options.inlineSourceMap = false;
        
        //todo: check if tsconfig.json not found
        const configFileName = (options && options.project) || TS.findConfigFile(plug.options.context, TS.sys.fileExists);
        const configFile = await plug.addFileFromFS(configFileName);
        
        if (!cache.program || cache.oldConfigFile !== configFile || configFile.updated) {
            cache.oldConfigFile = configFile;
            logger.info('Using ' + configFile.relativeName);
            const result = TS.parseConfigFileTextToJson(configFileName, configFile.contentString);
            const configObject = result.config;
            cache.configParseResult = TS.parseJsonConfigFileContent(configObject, TS.sys, path.dirname(configFile.fullName), options, configFile.fullName);
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
                plug.addDistFile(file, data);
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
        //todo:
        if (diagnostics.length) {
            logger.error(diagnostics.toString());
        }
        cache.program = program;
    });
}