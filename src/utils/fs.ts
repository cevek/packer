import {promisify} from './promisify';
import * as fs from 'fs';
import FastPromise from "fast-promise";

export interface GlobOptions {
    cwd?: string;
}

export type Glob = string | string[] | RegExp | RegExp[];


// export const writeFile: (filename: string, content: string | Buffer) => Promise<Buffer> = promisify(fs.writeFile, fs);
export async function writeFile(filename: string, content: string | Buffer) {
    return fs.writeFileSync(filename, content);
}

// export const readFile: (filename: string) => Promise<Buffer> = promisify(fs.readFile, fs);
export async function readFile(filename: string) {
    return fs.readFileSync(filename);
}
export const glob: (glob: Glob, options: GlobOptions) => Promise<string[]> = promisify(require("glob"));
export const mkdirp: (dirname: string) => Promise<string[]> = promisify(require('mkdirp'));

export function fileExists(filename: string) {
    return new FastPromise<boolean>(resolve => {
        fs.access(filename, (fs as any).F_OK, err => resolve(!err));
    });
}

export function readFileSync(filename: string) {
    return fs.readFileSync(filename);
}
