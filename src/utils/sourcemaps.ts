import {logger} from "./logger";
const charToInteger: {[n: string]: number} = {};
const charToInteger2: {[n: number]: number} = new Array(256 * 256);
const integerToChar: {[n: number]: string} = {};

'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='.split('').forEach(function (char, i) {
    charToInteger[char/*.codePointAt(0)*/] = i;
    charToInteger2[char.codePointAt(0)] = i;
    integerToChar[i] = char/*.codePointAt(0)*/;
});

export function sourcemapDiffCalc(str: string) {
    const len = str.length;
    var shift = 0;
    var value = 0;
    var fieldN = 0;
    var genLine = 0;
    var genCol = 0;
    var filePos = 0;
    var line = 0;
    var col = 0;
    var named = 0;
    var segments = 1;
    var integer: number;
    var hasContinuationBit: number;
    var sym: number;
    var shouldNegate: number;


    for (var i = 0; i < len; i++) {
        sym = str.charCodeAt(i);
        if (sym === 59 /*;*/) {
            segments++;
            shift = 0;
            value = 0;
            fieldN = 0;
            genLine++;
            genCol = 0;
            continue;
        } else if (sym == 44 /*,*/) {
            segments++;
            shift = 0;
            value = 0;
            fieldN = 0;
            continue;
        }
        integer = charToInteger2[sym];

        hasContinuationBit = integer & 32;

        integer &= 31;
        value += integer << shift;

        if (hasContinuationBit) {
            shift += 5;
        } else {
            shouldNegate = value & 1;
            value >>= 1;
            value = shouldNegate ? -value : value;

            switch (fieldN) {
                case 0:
                    genCol += value;
                    break;
                case 1:
                    filePos += value;
                    break;
                case 2:
                    line += value;
                    break;
                case 3:
                    col += value;
                    break;
                case 4:
                    named += value;
                    break;
            }

            fieldN++;
            //     reset
            value = shift = 0;
        }
    }
    return {genLine, genCol, filePos, line, col, named, segments};
}


export function encode(a: number, b: number, c: number, d: number) {
    return encodeInteger(a) + encodeInteger(b) + encodeInteger(c) + encodeInteger(d);
}

// todo:deopts
function encodeInteger(num: number) {
    var result = '';
    var clamped: number;

    if (num < 0) {
        num = ( -num << 1 ) | 1;
    } else {
        num <<= 1;
    }
    do {
        clamped = num & 31;
        num >>= 5;

        if (num > 0) {
            clamped |= 32;
        }

        result += integerToChar[clamped];
    } while (num > 0);

    return result;
}


export class SourceMap {
    version = 3;
    sourceRoot = '';
    sources: string[] = [];
    mappings = '';
    sourcesContent: string[] = [];

    toString() {
        return `{"version":${this.version},"sourceRoot":"${this.sourceRoot}","sources":["${this.sources.join('","')}"],"mappings":"${this.mappings}","sourcesContent":[${this.sourcesContent.map(c => JSON.stringify(c)).join(',')}]}`;
        // return JSON.stringify(this);
    }
}


export class SourceMapWriter {
    private mappings: string = '';
    private sources: string[] = [];
    private sourcesContent: string[] = [];

    private genLineNum = 0;

    private genColNum = 0;
    private prevGenColNum = 0;

    private fileNum = 0;
    private prevFileNum = 0;

    private colNum = 0;
    private prevColNum = 0;
    private lineNum = 0;
    private prevLineNum = 0;

    private lastSemicolon = true;

    private addSegment(s: string) {
        const length = this.mappings.length;
        if (length > 0 && s.length > 0 && s[0] !== ';' && !this.lastSemicolon) {
            this.mappings += ',';
        }
        this.mappings += s;
        this.lastSemicolon = s[s.length - 1] === ';';
    }


    private writeSegment() {
        this.addSegment(encode(
            this.genColNum - this.prevGenColNum/*gen col*/,
            this.fileNum - this.prevFileNum/*source shift*/,
            this.lineNum - this.prevLineNum/* orig line shift*/,
            this.colNum - this.prevColNum/* orig col shift*/
        ));
        this.prevGenColNum = this.genColNum;
        this.prevFileNum = this.fileNum;
        this.prevLineNum = this.lineNum;
        this.prevColNum = this.colNum;
    }

    writeNextLine() {
        this.addSegment(';');
        this.genLineNum++;
        this.genColNum = 0;
        this.prevGenColNum = 0;
    }


    skipCode(content: string) {
        // this.mappings.push(encode([this.genColNum/*gen col*/, 0/*source shift*/, 0/* orig line shift*/, -this.colNum/* orig col shift*/]));
        // this.colNum = 0;
        let i = -1;
        let len = content.length;
        while (++i < len) {
            if (content.charCodeAt(i) === 10 /*\n*/) {
                this.writeNextLine();
            }
        }
    }

    private countLines(content: string) {
        let i = -1;
        let len = content.length;
        let count = 0;
        while (++i < len) {
            if (content.charCodeAt(i) === 10 /*\n*/) {
                count++;
            }
        }
        return count;
    }

    putFile(content: string, sourceName: string) {
        this.sources.push(sourceName);
        this.sourcesContent.push(content);
        // const perFile: any[] = [];
        this.lineNum = 0;
        this.colNum = 0;
        this.writeSegment();
        let i = -1;
        let len = content.length;
        while (++i < len) {
            if (content.charCodeAt(i) === 10 /*\n*/) {
                this.writeSegment();
                this.writeNextLine();

                this.lineNum++;
                this.colNum = 0;
                this.writeSegment();
                continue;
            }
            this.colNum++;
            this.genColNum++;
        }
        this.fileNum++;
    }

    putExistSourceMap(content: string, sourceMap: SourceMap) {
        const sourcesCount = sourceMap.sources.length;
        for (let i = 0; i < sourcesCount; i++) {
            this.sources.push(sourceMap.sources[i]);
            this.sourcesContent.push(sourceMap.sourcesContent[i] || '');
        }
        this.colNum = 0;
        this.lineNum = 0;
        this.writeSegment();
        this.addSegment(sourceMap.mappings);
        const linesCount = this.countLines(content);
        const diff = sourcemapDiffCalc(sourceMap.mappings);
        const diffLines = linesCount - diff.genLine
        if (diffLines > 0) {
            for (let i = 0; i < diffLines; i++) {
                this.writeNextLine();
            }
        }
        if (diffLines < 0) {
            logger.error('Incorrect mappings for ' + JSON.stringify(sourceMap));
        }

        this.genLineNum += diff.genLine + diffLines;

        this.genColNum = diff.genCol;
        this.prevGenColNum = diff.genCol;

        this.fileNum += sourcesCount;
        // todo: why?
        this.prevFileNum += diff.filePos;

        this.lineNum += diff.line;
        this.prevLineNum = diff.line;

        this.colNum += diff.col;
        this.prevColNum = diff.col;
    }

    toSourceMap() {
        const sm = new SourceMap();
        sm.sourcesContent = this.sourcesContent;
        sm.sources = this.sources;
        sm.mappings = this.mappings;//.replace(/,?;,?/g, ';');
        // console.log(sm.mappings);
        // console.log(this.fileNum);
        return sm;
    }
}


export function extractSourceMapAndRemoveItFromFile(content: string) {
    const commentRx = /^\s*\/(?:\/|\*)[@#]\s+sourceMappingURL=data:(?:application|text)\/json;(?:charset[:=]\S+;)?base64,(.*)$/mg;
    //Example
    //     //# sourceMappingURL=foo.js.map
    //     /*# sourceMappingURL=foo.js.map */
    const mapFileCommentRx = /(?:\/\/[@#][ \t]+sourceMappingURL=([^\s'"]+?)[ \t]*$)|(?:\/\*[@#][ \t]+sourceMappingURL=([^\*]+?)[ \t]*(?:\*\/){1}[ \t]*$)/mg;


    let sourceFileContent: string;
    let sourceFileName: string;
    content = content.replace(commentRx, (m, m1) => {
        sourceFileContent = new Buffer(m1, 'base64').toString();
        return '';
    });

    if (!sourceFileContent) {
        content = content.replace(mapFileCommentRx, (m, m1, m2) => {
            sourceFileName = m1 || m2;
            return '';
        });
    }
    return {content, sourceFileContent, sourceFileName};
}

export function parseSourceMapJSON(filename: string, str: string): SourceMap {
    try {
        return JSON.parse(str);
    } catch (e) {
        throw new Error('SourceMap parse error in ' + filename);
    }
}