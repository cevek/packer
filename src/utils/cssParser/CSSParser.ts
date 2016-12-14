const enum Symbols {
    NEW_LINE = 10,
    TAB = 9,
    SPACE = 32,
    SLASH = 47,
    BACK_SLASH = 92,
    ASTERIKCS = 42,
    APOSTROF = 39,
    QUOTE = 34,
    U = 85,
    u = 117,
    BRACES_OPEN = 40,
    BRACES_CLOSES = 41,
}
const enum Types {
    CODE = 0,
    SPACE = 4,
    STRING = 3,
}
const globMap = new Array<number>(256 * 256);
globMap.fill(Types.CODE);

globMap[Symbols.NEW_LINE] = Types.SPACE;
globMap[Symbols.TAB] = Types.SPACE;
globMap[Symbols.SPACE] = Types.SPACE;

globMap[Symbols.APOSTROF] = Types.STRING;
globMap[Symbols.QUOTE] = Types.STRING;

export class CSSParser {
    parse(code: string) {
        let i = -1;
        let x = 0;
        let startS = 0;
        let type = 0;
        const len = code.length;

        let strSym = 0;
        let nextX = 0;

        main: while (++i < len) {
            x = code.charCodeAt(i);
            type = globMap[x];

            if (type === Types.STRING) {
                strSym = x;
                startS = i;
                while (++i < len) {
                    x = code.charCodeAt(i);
                    if (x === Symbols.BACK_SLASH) {
                        i++;
                        continue;
                    }
                    if (x === strSym) {
                        continue main;
                    }
                }
            }


            if (x === Symbols.SLASH) {
                nextX = code.charCodeAt(i + 1);

                // block comment /*
                if (nextX === Symbols.ASTERIKCS) {
                    startS = i;
                    i++;
                    while (++i < len) {
                        x = code.charCodeAt(i);
                        if (x === Symbols.ASTERIKCS) {
                            x = code.charCodeAt(i++);
                            if (x === Symbols.SLASH) {
                                continue main;
                            }
                        }
                    }
                }
            }

            if ((x === Symbols.u || x === Symbols.U) && code.charCodeAt(i + 4) === Symbols.BRACES_OPEN && /^url\($/i.test(code.substr(i, i + 4))) {
                // read string
                // maybe ws
                while (++i < len) {
                    x = code.charCodeAt(i);
                    if (x === Symbols.BRACES_CLOSES) {
                        // todo: return value, startPos, endPos
                        break;
                    }
                }
            }
        }
    }
}