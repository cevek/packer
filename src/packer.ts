import * as path from "path";
import * as fs from "fs";
import {FileItem} from "./utils/FileItem";
import {glob, Glob, readFile, readFileSync} from "./utils/fs";
import {logger} from "./utils/logger";
import {padRight, padLeft} from "./utils/common";
import chokidar = require('chokidar');


export interface PackerOptions {
    context: string;
    dest: string;
}

export class Packer {
    protected plug: Plug;


    constructor(public options: PackerOptions, protected executor: (promise: Promise<Plug>)=>Promise<Plug>) {

    }

    async process() {
        this.plug = new Plug(false, this.options);
        this.plug.measureStart('overall');
        logger.info(`Build started...`);
        await this.executor(Promise.resolve(this.plug));
        const dur = this.plug.measureEnd('overall');
        logger.info(`Build done after ${dur | 0}ms`);
    }

    private async watchRunner(callback: () => void) {
        this.plug.measureStart('overall');
        logger.info(`Incremental build started...`);
        await this.executor(Promise.resolve(this.plug));
        const dur = this.plug.measureEnd('overall');
        const allMeasures = this.plug.getAllMeasures();
        for (let i = 0; i < allMeasures.length; i++) {
            const m = allMeasures[i];
            logger.info(`${padRight(m.name, 20)} ${padLeft(m.dur | 0, 6)}ms`);
        }
        logger.info(`Incremental build done after ${dur | 0}ms\n`);
        callback();
        this.plug.watcher.once('change', (filename: string) => {
            this.plug.clear();
            this.plug.addFileFromFS(filename, true).then(() => {
                // console.log('changed', filename);

                setTimeout(() => {
                    this.watchRunner(callback);
                }, 50);
            });
        });
    }

    async watch(callback: ()=>void) {
        this.plug = new Plug(true, this.options);
        this.watchRunner(callback);
    }
}

export function plugin(name: string, fn: (plug: Plug)=>Promise<void>) {
    return (plug: Plug) => {
        return new Promise<Plug>((resolve, reject) => {
            plug.measureStart(name);
            fn(plug).then(() => {
                plug.measureEnd(name);
                resolve(plug);
            }, reject);
        });
    }
}


export class Plug {
    options: PackerOptions;
    jsEntries: FileItem[] = [];
    tage: {[index: string]: FileItem} = {};
    watcher = chokidar.watch('');
    protected measures: {[name: string]: {name: string; start: [number, number]; dur: number;}} = {};
    protected cacheData: any = Object.create(null);
    protected fileCache = new Map<string, FileItem>();
    protected dirCache = new Map<string, boolean>();


    getGeneratedFiles() {
        const files: FileItem[] = [];
        for (const [, file] of this.fileCache) {
            if (file && !file.fromFileSystem) {
                files.push(file);
            }
        }
        return files;
    }

    constructor(public watchMode: boolean, options: PackerOptions) {
        const defaultOptions = {
            context: process.cwd(),
            dest: 'dist'
        };
        if (options.context) {
            defaultOptions.context = path.resolve(options.context);
        }
        if (options.dest) {
            defaultOptions.dest = options.dest;
        }
        this.options = defaultOptions;

        if (this.options.dest) {
            this.options.dest = this.normalizeName(this.options.dest);
        }
    }

    addDistFile(fullname: string, content: string | Buffer, originals?: FileItem | FileItem[]) {
        const distFile = this.addFile(fullname, content, false);
        if (originals instanceof Array) {
            distFile.originals.push(...originals);
        } else if (originals) {
            distFile.originals.push(originals);
        }
        return distFile;
    }

    protected addFile(fullname: string, content: string | Buffer, fromFileSystem: boolean): FileItem {
        let file: FileItem;
        if (fromFileSystem) {
            fullname = this.normalizeName(fullname);
        } else {
            fullname = this.normalizeDestName(fullname);
        }
        file = this.fileCache.get(fullname);
        if (file) {
            file.fromFileSystem = fromFileSystem;
            if (content) {
                file.setContent(content);
            }
            return file;
        }
        file = new FileItem(fullname, typeof content == 'string' ? new Buffer(content) : content, this.options.context, fromFileSystem);
        this.fileCache.set(file.fullName, file);

        //todo: get name from original file
        /*
         const sourceMapFileName = file.fullName + '.map';
         const sourceMapFile = this.getFileByName(sourceMapFileName);
         if (sourceMapFile) {
         file.sourcemapFile = sourceMapFile;
         sourceMapFile.isSourceMap = true;
         }
         */
        /*
         // if file source map stick to origin file
         if (file.ext == 'map') {
         const originFileName = file.dirname + file.basenameWithoutExt;
         const originFile = this.getFileByName(originFileName);
         if (originFile) {
         originFile.sourcemapFile = file;
         file.isSourceMap = true;
         }
         }*/
        return file;
    }


    normalizeName(filename: string) {
        filename = path.normalize(filename);
        filename = path.isAbsolute(filename) ? filename : path.normalize(this.options.context + '/' + filename);
        return filename;
    }

    normalizeDestName(filename: string) {
        filename = path.normalize(filename);
        if (path.isAbsolute(filename)) {
            filename = path.relative(this.options.dest, filename);
            // console.log('rel', filename);
        }

        //todo: check
        filename = filename.replace(/\.\.\//g, '');
        filename = path.normalize(this.options.dest + '/' + filename);
        return filename;
    }

    removeFile(file: FileItem) {
        if (this.fileCache.get(file.fullName) == null) {
            this.printAllGeneratedFiles();
            throw new Error(`File ${file.fullName} not found`);
        }
        this.fileCache.set(file.fullName, null);
        return this;
    }

    async isFileExists(filename: string) {
        filename = this.normalizeName(filename);
        const file = this.fileCache.get(filename);
        if (file === null) {
            return false;
        }
        // if read error then set null
        try {
            await this.addFileFromFS(filename);
        } catch (e) {
            this.fileCache.set(filename, null);
            return false;
        }
        return true;
    }

    isFileExistsSync(filename: string) {
        filename = this.normalizeName(filename);
        const file = this.fileCache.get(filename);
        if (file === null) {
            return false;
        }
        // if read error then set null
        try {
            this.addFileFromFSSync(filename);
        } catch (e) {
            this.fileCache.set(filename, null);
            return false;
        }
        return true;
    }

    getFileFromStage(filename: string) {
        filename = this.normalizeDestName(filename);
        const file = this.fileCache.get(filename);
        if (!file) {
            this.printAllGeneratedFiles();
            throw new Error(`File ${filename} doesn't exists on stage`);
        }
        return file;
    }


    addFileFromFSSync(filename: string, content?: string | Buffer) {
        filename = this.normalizeName(filename);
        let file = this.fileCache.get(filename);
        if (!file) {
            const data = content || readFileSync(filename);
            file = this.addFile(filename, data, true);
            this.fileCache.set(filename, file);
        }
        if (!file.isNodeModule && file.fromFileSystem) {
            this.watcher.add(filename);
        }
        if (!file.fromFileSystem) {
            this.printAllGeneratedFiles();
            throw new Error('File ' + file.fullName + ' exists as generated file');
        }
        return file;
    }

    async addFileFromFS(filename: string, force?: boolean): Promise<FileItem> {
        filename = this.normalizeName(filename);
        let file = this.fileCache.get(filename);
        if (!file || force) {
            if (filename.indexOf(this.options.dest) === 0) {
                throw new Error('File ' + filename + ' not found');
            }
            const data = await readFile(filename);
            file = this.addFile(filename, data, true);
            this.fileCache.set(filename, file);
        }
        if (!file.isNodeModule) {
            this.watcher.add(filename);
        }
        return file;
    }

    async findFiles(filesGlob: Glob): Promise<FileItem[]> {
        if (!filesGlob) {
            return [];
        }
        const filenames = await glob(filesGlob, {
            cwd: this.options.context
        });
        const files: FileItem[] = [];
        for (let i = 0; i < filenames.length; i++) {
            const filename = filenames[i];
            const file = await this.addFileFromFS(filename);
            files.push(file);
        }
        return files;

        /*
         return new Promise((resolve, reject) => {
         if (!filesGlob) {
         return resolve([]);
         }

         // this.watcher.add(filesGlob);
         glob(filesGlob, {
         cwd: this.options.context
         }, (err: any, files: string[]) => {
         if (err) {
         return reject(err);
         }
         Promise.all(files.map(f => this.addFileFromFS(f))).then(resolve);
         });
         });
         */
    }

    dirExistsSync(filename: string) {
        filename = this.normalizeName(filename);
        let result = this.dirCache.get(filename);
        if (result !== undefined) {
            return result;
        }
        try {
            const stat = fs.statSync(filename);
            const result = stat.isDirectory();
            this.dirCache.set(filename, result);
            return result;
        }
        catch (e) {
            this.dirCache.set(filename, false);
            return false;
        }
    }


    getCache(name: string): any {
        let cacheItem = this.cacheData[name];
        if (!cacheItem) {
            cacheItem = this.cacheData[name] = Object.create(null);
        }
        return cacheItem;
    }

    clear() {
        this.watcher.close();
        this.watcher = chokidar.watch('');
        this.jsEntries = [];
        this.measures = {};
        for (const [,file] of this.fileCache) {
            if (file) {
                file.updated = false;
            }
        }
    }

    measureStart(name: string) {
        let measure = this.measures[name];
        if (!measure) {
            measure = this.measures[name] = {
                name, start: null, dur: 0
            };
        }
        measure.start = process.hrtime();
    }

    measureEnd(name: string) {
        const m = this.measures[name];
        const diff = process.hrtime(m.start);
        m.dur += diff[0] * 1000 + diff[1] / 1e6;
        return m.dur;
    }

    getAllMeasures() {
        return Object.keys(this.measures).map(key => this.measures[key]);
    }

    getMeasure(name: string) {
        return this.measures[name];
    }

    getFileFromCache(filename: string) {
        filename = this.normalizeName(filename);
        return this.fileCache.get(filename);
    }

    printAllGeneratedFiles() {
        logger.data('Generated tree files');
        this.getGeneratedFiles().forEach(file => logger.data('  ' + file.relativeName));
    }
}





