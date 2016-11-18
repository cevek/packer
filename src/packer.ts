import "./helpers";
import {logger} from "./utils/logger";
import {padRight, padLeft, formatBytes} from "./utils/common";
import {Plugin} from "./utils/Plugin";
import * as path from "path";
import chokidar = require('chokidar');
import FastPromise from "fast-promise";
import Timer = NodeJS.Timer;
export * from "./utils/Plugin";

export {combineJS} from "./plugins/combineJS";
export {combineCSS} from "./plugins/combineCSS";
export {copy} from "./plugins/copy";

export interface PackerOptions {
    context: string;
    dest: string;
    sourceMap?: boolean;
    alias?: {[module: string]: string};
}

export type PackerResult = string[];

export class Packer {
    protected plug: Plugin;
    public options: PackerOptions;

    constructor(options: PackerOptions, protected executor: (promise: Promise<Plugin>)=>Promise<Plugin>) {
        this.processOptions(options);
    }

    private processOptions(options: PackerOptions) {
        const defaultOptions: PackerOptions = {
            context: process.cwd(),
            sourceMap: true,
            dest: 'dist',
            alias: null,
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
        defaultOptions.alias = options.alias;
        this.options = defaultOptions;
    }

    async process() {
        this.plug = new Plugin(false, this.options);
        this.plug.performance.measureStart('overall');
        logger.info(`Build started...`);
        await this.exec();
        const dur = this.plug.performance.measureEnd('overall');
        logger.info(`Build done after ${dur | 0}ms`);
        return this.result();
    }

    private async exec() {
        await this.executor(FastPromise.resolve(this.plug));
        const files = this.plug.stage.list();
        // plug.printAllGeneratedFiles()
        // plug.printStageFiles();
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.updated && this.plug.inDestFolder(file)) {
                await this.plug.fs.write(file);
                const content = await this.plug.fs.readContent(file);//todo: buffer length
                this.plug.outputFiles.add(file);
                logger.success(padRight(`Emit file: ${this.plug.fs.relativeName(file)}`, 40) + padLeft(formatBytes(content.length), 10));
            }
        }
    }

    private result() {
        return [...this.plug.outputFiles].map(file => this.plug.relativeToDest(file))
    }

    private timeout: Timer;
    private async watchRunner(callback: (files: PackerResult) => void) {
        try {
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
            if (callback) {
                callback(this.result());
            }
        } catch (e) {
            logger.error(e instanceof Error ? e.stack : e);
        }
        let timerRunned = false;
        const changedFiles: string[] = [];
        clearTimeout(this.timeout);
        let listener = (filename: string) => {
            //hack
            if (!path.isAbsolute(filename)) {
                return;
            }
            changedFiles.push(filename);
            if (!timerRunned) {
                timerRunned = true;
                this.timeout = setTimeout(async() => {
                    this.plug.clear();
                    logger.clear();
                    this.plug.watcher.removeListener('change', listener);
                    for (let i = 0; i < changedFiles.length; i++) {
                        const filename = changedFiles[i];
                        const file = this.plug.fs.findOrCreate(filename);
                        await this.plug.fs.readContent(file, true);
                        logger.info('Changed ' + this.plug.fs.relativeName(file));
                    }
                    await this.watchRunner(callback);
                }, 50);
            }
        };
        this.plug.watcher.on('change', listener);
    }

    async watch(callback: (files: PackerResult)=>void) {
        this.plug = new Plugin(true, this.options);
        await this.watchRunner(callback);
        return this;
    }
}

export function plugin(name: string, fn: (plug: Plugin)=>Promise<void>) {
    return (plug: Plugin) => {
        return new Promise<Plugin>((resolve, reject) => {
            plug.performance.measureStart(name);
            fn(plug).then(() => {
                plug.performance.measureEnd(name);
                resolve(plug);
            }, reject);
        });
    }
}






