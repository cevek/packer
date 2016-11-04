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
    let result = '';
    let clamped: number;

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

    private addSegment(s: string) {
        const length = this.mappings.length;
        if (length > 0 && s.length && s[0] !== ';' && this.mappings[length - 1] !== ';') {
            this.mappings += ',';
        }
        this.mappings += s;
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

    putExistSourceMap(sourceMap: SourceMap) {
        const sourcesCount = sourceMap.sources.length;
        for (let i = 0; i < sourcesCount; i++) {
            this.sources.push(sourceMap.sources[i]);
            this.sourcesContent.push(sourceMap.sourcesContent[i] || '');
        }
        this.colNum = 0;
        this.lineNum = 0;
        this.writeSegment();
        this.addSegment(sourceMap.mappings);
        const diff = sourcemapDiffCalc(sourceMap.mappings);

        this.genLineNum += diff.genLine;

        this.genColNum = diff.genCol;
        this.prevGenColNum = diff.genCol;

        this.fileNum += sourcesCount;
        // todo: why?
        this.prevFileNum += diff.filePos;

        this.lineNum += diff.line;
        this.prevLineNum = diff.line;

        this.colNum += diff.col;
        this.prevColNum = diff.col;

        //todo: why?
        this.writeNextLine();
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
