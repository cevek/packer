import {promisify} from "./promisify";
import * as fs from "fs";
import {Stats} from "fs";
import * as path from "path";
import {logger} from "./logger";
import {SourceFile, FileStat} from "./SourceFile";

export interface GlobOptions {
    cwd?: string;
}

export type Glob = string | string[] | RegExp | RegExp[];

const writeFileAsync = promisify<Buffer>(fs.writeFileSync, fs);
const readFileAsync = promisify<Buffer>(fs.readFile, fs);
const statAsync = promisify<Stats>(fs.stat, fs);

const globAsync = promisify<string[]>(require("glob"));
const mkdirpAsync = promisify(require('mkdirp'));


export class CachedFS {
    // null - file doesn't exist
    private nodes = new Map<string, SourceFile>();
    useSyncMethods = true;
    private context: string;

    constructor(context: string) {
        this.context = context;
    }

    private createStat(filename: string, stats: Stats) {
        const file = new SourceFile(filename, FileStat.fromNodeStats(stats));
        this.nodes.set(filename, file);
        return file;
    }

    getGeneratedFiles() {
        const files: SourceFile[] = [];
        for (const [, file] of this.nodes) {
            if (file && !file.isGenerated) {
                files.push(file);
            }
        }
        return files;
    }

    getFromCache(filename: string) {
        const file = this.nodes.get(filename);
        if (file === null) {
            throw new Error('File ' + filename + ' not found');
        }
        return file;
    }

    createGeneratedFile(filename: string, content: Buffer | string) {
        if (this.getFromCache(filename)) {
            throw new Error('File ' + filename + ' already exists in cache');
        }
        const stat = new FileStat(false, true);
        const file = new SourceFile(filename, stat);
        file.setContent(content);
        file.isGenerated = true;
        this.nodes.set(filename, file);
        return file;
    }

    async read(filename: string, force = false) {
        let file = this.getFromCache(filename);
        if (!file) {
            const stats = this.useSyncMethods ? fs.statSync(filename) : await statAsync(filename);
            const file = new SourceFile(filename, FileStat.fromNodeStats(stats));
            this.nodes.set(filename, file);
        }
        if (!file.contentLoaded || force) {
            const content = this.useSyncMethods ? fs.readFileSync(filename) : await readFileAsync(filename);
            file.setContent(content);
        }
        return file;
    }

    readSync(filename: string) {
        let file = this.getFromCache(filename);
        if (!file) {
            const stats = fs.statSync(filename);
            const file = new SourceFile(filename, FileStat.fromNodeStats(stats));
            this.nodes.set(filename, file);
        }
        if (!file.contentLoaded) {
            const content = fs.readFileSync(filename);
            file.setContent(content);
        }
        return file;
    }

    async readStats(filename: string) {
        return this.getFromCache(filename) ||
            this.createStat(filename, this.useSyncMethods ? fs.statSync(filename) : await statAsync(filename));
    }

    readStatsSync(filename: string) {
        return this.getFromCache(filename) || this.createStat(filename, fs.statSync(filename));
    }

    async tryFile(filename: string) {
        try {
            return await this.readStats(filename);
        } catch (e) {
            this.nodes.set(filename, null);
            return null;
        }
    }

    tryFileSync(filename: string): SourceFile {
        try {
            return this.readStatsSync(filename);
        } catch (e) {
            this.nodes.set(filename, null);
            return null;
        }
    }


    async rename(file: SourceFile, newFilename: string) {
        this.nodes.delete(file.fullName);
        this.nodes.set(newFilename, file);
        file.setFullName(newFilename);
    }

    async mkDir(dirname: string) {
        const existDir = await this.tryFile(dirname);
        if (existDir && existDir.stat.isDirectory) {
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

    printAllGeneratedFiles() {
        logger.data('Generated tree files');
        this.getGeneratedFiles().forEach(file => logger.data('  ' + file.relativeName));
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
            files.push(await this.readStats(filename));
        }
        return files;
    }
}