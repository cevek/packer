import {SourceMap} from './sourcemaps';
import * as path from 'path';
import crypto = require('crypto');
import {mkdirp, writeFile} from './fs';
import {logger} from './logger';
import {formatBytes, padRight, padLeft} from './common';

let id = 1;

const nodeModulesRegexp = /\/node_modules\//;
export class FileItem {
    id = id++;
    originals: FileItem[] = [];
    
    constructor(fullName: string, content: Buffer, public context: string, fromFileSystem: boolean, isSourceMap?: boolean) {
        // console.log('create new file', fullName);
        this.fromFileSystem = fromFileSystem;
        this.setName(fullName);
        this.setContent(content);
        this.isNodeModule = nodeModulesRegexp.test(fullName);
        this.updated = true;
    }
    
    fromFileSystem: boolean;
    fullName: string;
    // numberName: number;
    relativeName: string;
    updated: boolean;
    content: Buffer;
    private _contentString: string;
    get contentString() {
        return this._contentString ? this._contentString : (this._contentString = this.content.toString());
    }
    
    sourcemap: SourceMap;
    sourcemapFile: FileItem;
    isSourceMap: boolean;
    isNodeModule: boolean;
    
    get basename() {
        return path.basename(this.fullName);
    }
    
    get ext() {
        return path.extname(this.fullName).substr(1);
    }
    
    get basenameWithoutExt() {
        return this.basename.replace(/\.[^.]+$/, '');
    }
    
    get dirname() {
        return path.dirname(this.fullName) + '/';
    }
    
    get relativeDirname() {
        return path.dirname(this.relativeName);
    }
    
    // lines = 0;
    // size = 0;
    
    imports: Import[];
    
    private setName(fullName: string) {
        this.fullName = path.resolve(fullName);
        this.relativeName = path.relative(this.context, this.fullName);
    }
    
    setContent(content: string | Buffer) {
        if (typeof content === 'string') {
            if (!this.content || this.contentString !== content) {
                this.content = new Buffer(content);
                this._contentString = content;
                this.updated = true;
            }
        } else {
            const string = content.toString();
            if (!this.content || this.contentString !== string) {
                this.content = content;
                this._contentString = string;
                this.updated = true;
            }
        }
    }
    
    async writeFileToFS(): Promise<void> {
        await mkdirp(path.dirname(this.fullName));
        logger.success(padRight(`Emit file: ${this.relativeName}`, 40) + padLeft(formatBytes(this.content.length), 10));
        await writeFile(this.fullName, this.content);
        this.updated = false;
    }
    
    toString() {
        return `FileItem<${this.relativeName}>`;
    }
}


export class Import {
    file: FileItem;
    module: string;
    startPos: number;
    endPos: number;
}