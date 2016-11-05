import * as path from "path";
import {PackerOptions} from "../packer";
import {CachedFS} from "./CachedFS";
import {PerformanceMeasurer} from "./Performance";

import chokidar = require('chokidar');
import {SourceFile} from "./SourceFile";
export class Plug {
    options: PackerOptions;
    jsEntries: SourceFile[] = [];
    watcher = chokidar.watch('');
    private cacheData = new Map<string, any>();

    getCache(name: string) {
        let data = this.cacheData.get(name);
        if (!data) {
            data = Object.create(null);
            this.cacheData.set(name, data);
        }
        return data;
    }

    // protected fileCache = new Map<string, FileItem>();
    // protected dirCache = new Map<string, boolean>();

    fs = new CachedFS(this.options.context);
    performance: PerformanceMeasurer;

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

    init() {

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

    clear() {
        this.watcher.close();
        this.watcher = chokidar.watch('');
        this.jsEntries = [];
        this.performance = new PerformanceMeasurer();
        this.fs.resetUpdatedFiles();
    }
}
