import {promisify} from "./promisify";
import * as fs from "fs";
import {Stats, FSWatcher} from "fs";
import * as path from "path";
import {SourceFile} from "./SourceFile";
import {logger} from "./logger";
import chokidar = require('chokidar');

export interface GlobOptions {
    cwd?: string;
}

export type Glob = string | string[] | RegExp | RegExp[];

const writeFileAsync = promisify<Buffer>(fs.writeFile, fs);
const readFileAsync = promisify<Buffer>(fs.readFile, fs);
const statAsync = promisify<Stats>(fs.stat, fs);

const globAsync = promisify<string[]>(require("glob"));
const mkdirpAsync = promisify(require('mkdirp'));

export class CachedFS {
    // null - file doesn't exist
    private nodes = new Map<string, SourceFile>();

    watcher: fs.FSWatcher = this.watchMode ? chokidar.watch('') : null;
    private watchedFiles = new Set<SourceFile>();

    useSyncMethods = true;
    skipNodeModulesWatch = true;

    constructor(private context: string, private watchMode: boolean) {}

    private createStat(filename: string, stats: Stats) {
        const file = new SourceFile(filename, stats.isDirectory());
        this.nodes.set(filename, file);
        return file;
    }

    getGeneratedFiles() {
        const files: SourceFile[] = [];
        for (const [, file] of this.nodes) {
            if (file && file.isGenerated) {
                files.push(file);
            }
        }
        return files;
    }

    getAllCached() {
        return [...this.nodes.values()].filter(file => !!file);
    }

    getFromCache(filename: string) {
        return this.nodes.get(filename);
    }

    createGeneratedFile(filename: string, content: Buffer | string, createdBy: SourceFile) {
        let file = this.getFromCache(filename);
        if (file) {
            file.setContent(content);
            return file;
            //throw new Error('File ' + filename + ' already exists in cache');
        }
        file = new SourceFile(filename, false);
        if (createdBy) {
            createdBy.createdFiles.add(file);
        }
        file.setContent(content);
        file.isGenerated = true;
        this.nodes.set(filename, file);
        return file;
    }

    async createGeneratedFromFile(filename: string, originalfile: SourceFile, createdBy: SourceFile) {
        await this.readContent(originalfile);
        return this.createGeneratedFile(filename, originalfile.content, createdBy);
    }

    findOrCreate(filename: string, isDir = false) {
        let file = this.getFromCache(filename);
        if (!file) {
            file = new SourceFile(filename, isDir);
            this.nodes.set(filename, file);
        }
        return file;
    }

    async readContent(file: SourceFile, force = false) {
        if (!file.contentLoaded || force) {
            this.watch(file);
            const content = this.useSyncMethods ? fs.readFileSync(file.fullName) : await readFileAsync(file.fullName);
            file.setContent(content);
        }
        return file.getContentString();
    }

    readContentSync(file: SourceFile, force = false) {
        if (!file.contentLoaded || force) {
            this.watch(file);
            const content = fs.readFileSync(file.fullName);
            file.setContent(content);
        }
        return file.getContentString();
    }

    async readStats(filename: string) {
        const file = this.getFromCache(filename);
        if (file === null) {
            return null;
        }
        return file ||
            this.createStat(filename, this.useSyncMethods ? fs.statSync(filename) : await statAsync(filename));
    }

    async tryFile(filename: string): Promise<SourceFile> {
        try {
            return await this.readStats(filename);
        } catch (e) {
            this.nodes.set(filename, null);
            return null;
        }
    }

    tryFileSync(filename: string): SourceFile {
        const file = this.getFromCache(filename);
        if (file === null) {
            return null;
        }
        return file || this._tryFileSync(filename);
    }

    private _tryFileSync(filename: string): SourceFile {
        try {
            return this.createStat(filename, fs.statSync(filename));
        } catch (e) {
            this.nodes.set(filename, null);
            return null;
        }
    }

    rename(file: SourceFile, newFilename: string) {
        this.nodes.delete(file.fullName);
        this.nodes.set(newFilename, file);
        file.setFullName(newFilename);
    }

    async mkDir(dirname: string) {
        const existDir = await this.tryFile(dirname);
        if (existDir && existDir.isDir) {
            return;
        }
        await mkdirpAsync(dirname);
        let dir = dirname;
        while (true) {
            const ndir = path.dirname(dir);
            if (ndir == dir) {
                break;
            }
            dir = ndir;
            const file = this.nodes.get(dir);
            if (!file) {
                this.createStat(dirname, this.useSyncMethods ? fs.statSync(dir) : await statAsync(dir));
            }
        }
    }

    async write(file: SourceFile) {
        await this.mkDir(file.dirName);
        this.useSyncMethods ? fs.writeFileSync(file.fullName, file.content) : await writeFileAsync(file.fullName, file.content);
    }

    async glob(glob: Glob, options: GlobOptions) {
        //todo: use minimatch with local methods
        const result = await globAsync(glob, options);
        for (let i = 0; i < result.length; i++) {
            const filename = result[i];
            await this.readStats(filename);
        }
    }

    resetUpdatedFiles() {
        for (const [,file] of this.nodes) {
            if (file) {
                file.updated = false;
            }
        }
    }

    async findFiles(filesGlob: Glob): Promise<SourceFile[]> {
        if (!filesGlob) {
            return [];
        }
        //todo: use minimatch and fs search
        const result = await globAsync(filesGlob, {
            cwd: this.context
        });
        const files: SourceFile[] = [];
        for (let i = 0; i < result.length; i++) {
            const filename = result[i];
            files.push(await this.readStats(this.normalizeName(filename)));
        }
        if (files.length == 0) {
            logger.error('Find files empty result by query: ' + filesGlob);
        }
        return files;
    }

    normalizeName(filename: string) {
        filename = path.normalize(filename);
        filename = path.isAbsolute(filename) ? filename : path.normalize(this.context + '/' + filename);
        return filename;
    }

    relativeName(file: SourceFile) {
        return path.relative(this.context, file.fullName);
    }

    watch(file: SourceFile) {
        if (this.watchMode) {
            if (!this.skipNodeModulesWatch || !file.fullName.match(/\/node_modules\//)) {
                this.watcher.add(file.fullName);
                this.watchedFiles.add(file);
            }
        }
    }

    getWatcherFiles() {
        return [...this.watchedFiles];
    }
}
