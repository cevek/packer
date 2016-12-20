import {SourceFile} from "./SourceFile";
export class SourceError extends Error {
    constructor(message: string, public file: SourceFile, public line: number, public column: number, public endLine?: number, public endColumn?: number) {
        super(`${message}\n${file.fullName}:${line}:${column}`);
    }

}