import './helpers';
import {logger} from './utils/logger';
import {padRight, padLeft, formatBytes} from './utils/common';
import {Plugin} from './utils/Plugin';
import * as path from 'path';
import FastPromise from 'fast-promise';
import chokidar = require('chokidar');
import Timer = NodeJS.Timer;
import {SourceFile} from './utils/SourceFile';
export * from './utils/Plugin';

export {combineJS} from './plugins/combineJS';
export {combineCSS} from './plugins/combineCSS';
export {copy} from './plugins/copy';
export {hash} from './plugins/hash';
export {conditional} from './utils/conditional';
export {replaceCode} from './plugins/replaceCode';
export {src} from './plugins/src';

export interface PackerOptions {
    context: string;
    dest: string;
    sourceMap?: boolean;
    alias?: { [module: string]: string };
    maxInlineSize?: number;
    publicPath?: string;
    skipNodeModulesWatch?: boolean;
}

export interface PackerResult {
    plugin: Plugin;
    runIteration: number;
    emittedFiles: SourceFile[];
    changedFiles: SourceFile[];
}

export class Packer {
    protected plug: Plugin;
    public options: PackerOptions;
    private runIteration = 1;

    constructor(options: PackerOptions, protected executor: (promise: Promise<Plugin>) => Promise<Plugin>) {
        this.processOptions(options);
    }

    private processOptions(options: PackerOptions) {
        const defaultOptions: PackerOptions = {
            context: process.cwd(),
            sourceMap: true,
            dest: 'dist',
            alias: null,
            maxInlineSize: 0,
            publicPath: '',
            skipNodeModulesWatch: false
        };
        if (options.context) {
            defaultOptions.context = path.resolve(options.context);
        }
        if (options.dest) {
            let dest = path.normalize(options.dest);
            dest = path.isAbsolute(dest) ? dest : path.normalize(defaultOptions.context + '/' + dest);
            defaultOptions.dest = dest;
        }
        if (typeof options.sourceMap === 'boolean') {
            defaultOptions.sourceMap = options.sourceMap;
        }
        if (typeof options.maxInlineSize === 'number') {
            defaultOptions.maxInlineSize = options.maxInlineSize;
        }
        if (typeof options.publicPath === 'string') {
            defaultOptions.publicPath = options.publicPath;
        }
        if (typeof options.skipNodeModulesWatch === 'boolean') {
            defaultOptions.skipNodeModulesWatch = options.skipNodeModulesWatch;
        }
        defaultOptions.alias = options.alias;
        this.options = defaultOptions;
    }

    async run(options: { watch?: boolean, nodeEnv?: boolean } = {}) {
        this.plug = new Plugin(options.watch, this.options, options.nodeEnv);
        if (options.watch) {
            this.plug.fs.watcher.on('change', this.listener);
            await this.watchRunner(true);
        } else {
            await this.runOnce();
        }
        return this;
    }

    private timer: any;
    listener = (filename: string) => {
        //hack
        if (!path.isAbsolute(filename)) {
            return;
        }
        this.changedFiles.add(filename);
        clearTimeout(this.timer);
        this.timer = setTimeout(() => {
            const promise = this.watchRunner();
        }, 10);
    };

    private result: FastPromise<PackerResult>;

    getResult() {
        return this.result;
    }

    private async runOnce() {
        this.result = new FastPromise<PackerResult>();
        this.plug.performance.measureStart('overall');
        logger.info(`Build started...`);
        await this.exec();
        const dur = this.plug.performance.measureEnd('overall');
        logger.info(`Build done after ${dur | 0}ms`);
        this.result.resolve(this.getCompilationResult());
        this.plug.destroy();
    }

    private changedFiles = new Set<string>();
    private watchRunnerInProgress = false;
    private buildNumber = 0;

    private async watchRunner(force = false) {
        if (!force && (this.watchRunnerInProgress || this.changedFiles.size == 0)) return;
        this.watchRunnerInProgress = true;
        try {
            this.buildNumber++;
            this.plug.reset();
            // logger.clear();
            await this.watchRunnerUpdateFiles();
            this.result = new FastPromise<PackerResult>();
            this.plug.performance.measureStart('overall');
            logger.info(`-------------------------------------\nIncremental build #${this.buildNumber} started...`);
            await this.exec();
            logger.info('exec next');
            const dur = this.plug.performance.measureEnd('overall');
            const allMeasures = this.plug.performance.getAllMeasures();
            for (let i = 0; i < allMeasures.length; i++) {
                const m = allMeasures[i];
                logger.info(`${padRight(m.name, 20)} ${padLeft(m.dur | 0, 6)}ms`);
            }
            logger.info(`Incremental build done after ${dur | 0}ms\n-------------------------------------`);
            this.result.resolve(this.getCompilationResult());
        } catch (e) {
            logger.error('Build #' + this.buildNumber + ' Error: ' + (e instanceof Error ? e.message : e));
        }
        this.watchRunnerInProgress = false;
        await this.watchRunner();
    }

    private async watchRunnerUpdateFiles() {
        const files = [...this.changedFiles];
        this.changedFiles.clear();
        for (let i = 0; i < files.length; i++) {
            const filename = files[i];
            const file = this.plug.fs.findOrCreate(filename);
            await this.plug.fs.readContent(file, true);
            if (file.updated) {
                logger.info('Changed ' + this.plug.fs.relativeName(file));
            }
        }
    }

    private async exec() {
        await this.executor(FastPromise.resolve(this.plug));
        const files = this.plug.fs.stage.list();
        // plug.printAllGeneratedFiles()
        // plug.printStageFiles();
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (this.plug.inDestFolder(file)) {
                this.plug.emittedFiles.add(file);
                if (file.updated) {
                    await this.plug.fs.write(file);
                    const content = await this.plug.fs.readContent(file);//todo: buffer length
                    this.plug.changedFiles.add(file);
                    logger.success(padRight(`Emit file: ${this.plug.fs.relativeName(file)}`, 40) + padLeft(formatBytes(content.length), 10));
                }
            }
        }
        this.plug.fs.resetUpdatedFiles();
    }

    private getCompilationResult() {
        const changedFiles = [...this.plug.changedFiles];
        const emittedFiles = [...this.plug.emittedFiles];
        const result: PackerResult = {
            plugin: this.plug,
            runIteration: this.runIteration++,
            changedFiles: changedFiles,
            emittedFiles: emittedFiles,
        };
        return result;
    }
}

export function plugin(name: string, fn: (plug: Plugin) => Promise<void>) {
    return (plug: Plugin) => {
        plug.performance.measureStart(name);
        return (fn(plug) as FastPromise<void>).then<Plugin,{name: string, plug: Plugin}>(pluginFulfill, null, {name, plug});
    };
}

function pluginFulfill(this: {name: string, plug: Plugin}) {
    this.plug.performance.measureEnd(this.name);
    return this.plug;
}




