import * as path from "path";
import * as fs from "fs";
import {PackerOptions} from "../packer";
import {CachedFS} from "./CachedFS";
import {PerformanceMeasurer} from "./Performance";
import {SourceFile} from "./SourceFile";

import chokidar = require('chokidar');
import {logger} from "./logger";
import {Stage} from "./Stage";
export class Plug {
    options: PackerOptions;
    jsEntries: SourceFile[] = [];
    fs: CachedFS;
    performance: PerformanceMeasurer;
    stage: Stage;

    watcher: fs.FSWatcher = chokidar.watch('');
    private cacheData = new Map<string, any>();


    constructor(public watchMode: boolean, options: PackerOptions) {
        const defaultOptions = {
            context: process.cwd(),
            sourceMap: true,
            dest: 'dist'
        };
        if (options.context) {
            defaultOptions.context = path.resolve(options.context);
        }
        if (options.dest) {
            defaultOptions.dest = options.dest;
        }
        if (typeof options.sourceMap === 'boolean') {
            defaultOptions.sourceMap = options.sourceMap;
        }
        this.options = defaultOptions;

        if (this.options.dest) {
            this.options.dest = this.normalizeName(this.options.dest);
        }
        this.fs = new CachedFS(this.options.context, this.watcher);
        this.performance = new PerformanceMeasurer();
        this.stage = new Stage();
    }

    getCache(name: string) {
        let data = this.cacheData.get(name);
        if (!data) {
            data = Object.create(null);
            this.cacheData.set(name, data);
        }
        return data;
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

    printAllGeneratedFiles() {
        logger.data('Generated tree files');
        this.fs.getGeneratedFiles().forEach(file => logger.data('  ' + this.fs.relativeName(file)));
    }

    printStageFiles() {
        logger.data('Stage files');
        this.stage.list().forEach(file => logger.data('  ' + this.fs.relativeName(file)));
    }

    clear() {
        // this.watcher.close();
        // this.watcher = chokidar.watch('');
        this.jsEntries = [];
        this.performance = new PerformanceMeasurer();
        this.fs.resetUpdatedFiles();
        // this.stage = new Stage();
    }
}
