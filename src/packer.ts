import {logger} from "./utils/logger";
import {padRight, padLeft} from "./utils/common";
import {Plug} from "./utils/Plugin";
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
        this.plug.performance.measureStart('overall');
        logger.info(`Build started...`);
        await this.executor(Promise.resolve(this.plug));
        const dur = this.plug.performance.measureEnd('overall');
        logger.info(`Build done after ${dur | 0}ms`);
    }

    private async watchRunner(callback: () => void) {
        try {
            this.plug.performance.measureStart('overall');
            logger.info(`Incremental build started...`);
            await this.executor(Promise.resolve(this.plug));
            const dur = this.plug.performance.measureEnd('overall');
            const allMeasures = this.plug.performance.getAllMeasures();
            for (let i = 0; i < allMeasures.length; i++) {
                const m = allMeasures[i];
                logger.info(`${padRight(m.name, 20)} ${padLeft(m.dur | 0, 6)}ms`);
            }
            logger.info(`Incremental build done after ${dur | 0}ms\n`);
            callback();
        } catch (e) {
            logger.error(e instanceof Error ? e.stack : e);
        }
        let timerRunned = false;
        const changedFiles: string[] = [];
        this.plug.watcher.on('change', (filename: string) => {
            changedFiles.push(filename);
            if (!timerRunned) {
                timerRunned = true;
                setTimeout(async() => {
                    this.plug.clear();
                    for (let i = 0; i < changedFiles.length; i++) {
                        const filename = changedFiles[i];
                        const file = await this.plug.fs.read(filename, true);
                        logger.info('Changed ' + file.relativeName);
                    }
                    await this.watchRunner(callback);
                }, 50);
            }
        });
    }

    async watch(callback: ()=>void) {
        this.plug = new Plug(true, this.options);
        await this.watchRunner(callback);
        return this;
    }
}

export function plugin(name: string, fn: (plug: Plug)=>Promise<void>) {
    return (plug: Plug) => {
        return new Promise<Plug>((resolve, reject) => {
            plug.performance.measureStart(name);
            fn(plug).then(() => {
                plug.performance.measureEnd(name);
                resolve(plug);
            }, reject);
        });
    }
}






