import * as path from "path";
import {Stats} from "fs";
export class SourceFile {
    fullName: string;
    dirName: string;
    content: Buffer;
    contentLoaded: boolean;
    stat: FileStat;
    updated = true;
    extName: string;
    isGenerated = false;
    private _contentString: string;
    imports: Import[];

    get contentString() {
        return this._contentString ? this._contentString : (this._contentString = this.content.toString());
    }

    getBasename(withoutExt = false) {
        return path.basename(this.fullName, withoutExt ? '.' + this.extName : '');
    }

    constructor(fullName: string, stat: FileStat) {
        this.setFullName(fullName);
        this.stat = stat;
        this.content = null;
        this.contentLoaded = false;
    }

    setContent(content: Buffer | string) {
        this.contentLoaded = !!content;
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

    setFullName(fullName: string) {
        this.fullName = fullName;
        this.extName = path.extname(fullName).substr(1);
        this.dirName = path.dirname(fullName);
    }
}

export class Import {
    file: SourceFile;
    module: string;
    startPos: number;
    endPos: number;
}


export class FileStat {
    constructor(public isDirectory: boolean, public isFile: boolean) {}

    static fromNodeStats(stats: Stats) {
        return new FileStat(stats.isDirectory(), stats.isFile());
    }
}