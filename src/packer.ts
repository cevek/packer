import "./helpers";
import {logger} from "./utils/logger";
import {padRight, padLeft, formatBytes} from "./utils/common";
import {Plugin} from "./utils/Plugin";
import * as path from "path";
import FastPromise from "fast-promise";
import chokidar = require('chokidar');
import Timer = NodeJS.Timer;
export * from "./utils/Plugin";

export {combineJS} from "./plugins/combineJS";
export {combineCSS} from "./plugins/combineCSS";
export {copy} from "./plugins/copy";
export {hash} from "./plugins/hash";
export {conditional} from "./utils/conditional";
export {replaceCode} from "./plugins/replaceCode";

export interface PackerOptions {
    context: string;
    dest: string;
    sourceMap?: boolean;
    alias?: {[module: string]: string};
    maxInlineSize?: number;
    publicPath?: string;
}

export interface PackerResult {
    runIteration: number;
    emittedFiles: string[];
    changedFiles: string[];
    emittedJSFiles: string[];
    emittedCSSFiles: string[];
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
        defaultOptions.alias = options.alias;
        this.options = defaultOptions;
    }

    async run(options: {watch?: boolean} = {}) {
        this.plug = new Plugin(options.watch, this.options);
        if (options.watch) {
            await this.watchRunner([]);
        } else {
            await this.runOnce();
        }
        return this;
    }

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

    private async watchRunner(changedFiles: string[]) {
        try {
            this.result = new FastPromise<PackerResult>();
            this.plug.performance.measureStart('overall');
            logger.info(`Incremental build started...`);
            await this.exec();
            const dur = this.plug.performance.measureEnd('overall');
            const allMeasures = this.plug.performance.getAllMeasures();
            for (let i = 0; i < allMeasures.length; i++) {
                const m = allMeasures[i];
                logger.info(`${padRight(m.name, 20)} ${padLeft(m.dur | 0, 6)}ms`);
            }
            logger.info(`Incremental build done after ${dur | 0}ms\n`);
            this.result.resolve(this.getCompilationResult());
        } catch (e) {
            logger.error('Error: ' + (e instanceof Error ? e.message : e));
        }
        let timerRunned = false;
        clearTimeout(this.timeout);
        let listener = (filename: string) => {
            //hack
            if (!path.isAbsolute(filename)) {
                return;
            }
            changedFiles.push(filename);
            if (!timerRunned) {
                timerRunned = true;
                this.timeout = setTimeout(async () => {
                    await this.watchRunnerUpdateFiles(changedFiles);
                    await this.watchRunner(changedFiles);
                    this.plug.fs.watcher.removeListener('change', listener);
                }, 50);
            }
        };
        this.plug.fs.watcher.on('change', listener);
    }

    private async watchRunnerUpdateFiles(changedFiles: string[]) {
        this.plug.reset();
        logger.clear();
        while (changedFiles.length) {
            const filename = changedFiles.shift();
            const file = this.plug.fs.findOrCreate(filename);
            await this.plug.fs.readContent(file, true);
            logger.info('Changed ' + this.plug.fs.relativeName(file));
        }
    }

    private async exec() {
        await this.executor(FastPromise.resolve(this.plug));
        const files = this.plug.stage.list();
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
    }

    private getCompilationResult() {
        const changedFiles = [...this.plug.changedFiles];
        const emittedFiles = [...this.plug.emittedFiles];
        const result: PackerResult = {
            runIteration: this.runIteration++,
            changedFiles: changedFiles.map(file => this.plug.relativeToDest(file)),
            emittedFiles: emittedFiles.map(file => this.plug.relativeToDest(file)),
            emittedJSFiles: [],
            emittedCSSFiles: []
        };
        result.emittedJSFiles = result.emittedFiles.filter(filename => /\.js$/i.test(filename));
        result.emittedCSSFiles = result.emittedFiles.filter(filename => /\.css$/i.test(filename));
        return result;
    }

    private timeout: Timer;
}

export function plugin(name: string, fn: (plug: Plugin) => Promise<void>) {
    return (plug: Plugin) => {
        return new FastPromise<Plugin>((resolve, reject) => {
            plug.performance.measureStart(name);
            fn(plug).then(() => {
                plug.performance.measureEnd(name);
                resolve(plug);
            }, reject);
        }) as Promise<Plugin>;
    }
}






