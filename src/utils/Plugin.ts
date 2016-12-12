import * as path from "path";
import * as fs from "fs";
import {PackerOptions} from "../packer";
import {CachedFS} from "./CachedFS";
import {PerformanceMeasurer} from "./Performance";
import {SourceFile} from "./SourceFile";

import chokidar = require('chokidar');
import {logger} from "./logger";
import {Stage} from "./Stage";
import {JSScanner} from "./jsParser/jsScanner";
export class Plugin {
    options: PackerOptions;
    jsEntries: SourceFile[];
    fs: CachedFS;
    performance: PerformanceMeasurer;
    stage: Stage;
    changedFiles: Set<SourceFile>;
    emittedFiles: Set<SourceFile>;
    jsScanner:JSScanner;

    private cacheData = new Map<string, any>();


    constructor(public watchMode: boolean, options: PackerOptions) {
        this.options = options;
        this.fs = new CachedFS(this.options.context, this.watchMode);
        this.performance = new PerformanceMeasurer();
        this.reset();
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
        return path.normalize(this.options.dest + '/' + filename);
    }

    printAllGeneratedFiles() {
        logger.data('Generated tree files');
        this.fs.getGeneratedFiles().forEach(file => logger.data('  ' + (file.fullName)));
    }

    printStageFiles() {
        logger.data('Stage files');
        this.stage.list().forEach(file => logger.data('  ' + this.fs.relativeName(file)));
    }

    relativeToDest(file: SourceFile) {
        return path.relative(this.options.dest, file.fullName);
    }

    inDestFolder(file: SourceFile) {
        return file.fullName.substr(0, this.options.dest.length) == this.options.dest;
    }

    reset() {
        this.stage = new Stage();
        this.jsEntries = [];
        this.jsScanner = new JSScanner(this);
        this.performance = new PerformanceMeasurer();
        this.emittedFiles = new Set();
        this.changedFiles = new Set();
        this.fs.resetUpdatedFiles();
    }

    destroy() {
        this.stage = null;
        this.jsEntries = null;
        this.jsScanner = null;
        this.performance = null;
        this.emittedFiles = null;
        this.changedFiles = null;
        this.fs = null;
        this.cacheData = null;
    }
}
