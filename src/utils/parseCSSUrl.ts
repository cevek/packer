const enum Symbols {
    SLASH = 47,
    ASTERIKCS = 42,
}

export interface CSSParseResult {
    start: number;
    end: number;
    url: string;
}
export function parseCSSUrl(css: string) {
    const regexp = /[\s:,%]url\(\s*["']?(.*?)["']?\s*\)/ig;
    const results:CSSParseResult[] = [];
    let result: RegExpExecArray;
    let i = 0;
    while (result = regexp.exec(css)) {
        let inComment = false;
        for (i = result.index; i >= 0; i--) {
            const code = css.charCodeAt(i);
            if (code === Symbols.SLASH) {
                const prevCode = css.charCodeAt(i - 1);
                if (prevCode === Symbols.ASTERIKCS) {
                    break;
                }
            }
            else if (code === Symbols.ASTERIKCS) {
                const prevCode = css.charCodeAt(i - 1);
                if (prevCode === Symbols.SLASH) {
                    inComment = true;
                    break;
                }
            }
        }
        if (!inComment) {
            results.push({start: result.index + 1, end: result.index + result[0].length, url: result[1]});
        }
    }
    return results;
}

/*
 TESTS

 console.log(parseCSSUrl(`
 b{background:url(data:a0);}
 a{background: url(a1);}

 b{background: url("a2");}

 b{background:Url('a3');}

 /!*comment0*!/

 b{background: url(  "a4"
 );}

 /!*b{background: url(/comment1);}*!/

 b{background: url(
 a5     );}

 /!*
 b{background: url(/comment2);}
 *!/

 b{background: url(
 a6     );}

 b{background: 10%url("a7");}

 b{background:url( 'a8'),url(a9 );}
 `));


 should be
 [ { start: 13, end: 20, url: 'data:a0' },
 { start: 42, end: 44, url: 'a1' },
 { start: 67, end: 69, url: 'a2' },
 { start: 93, end: 95, url: 'a3' },
 { start: 134, end: 136, url: 'a4' },
 { start: 200, end: 202, url: 'a5' },
 { start: 270, end: 272, url: 'a6' },
 { start: 304, end: 306, url: 'a7' },
 { start: 330, end: 332, url: 'a8' },
 { start: 341, end: 343, url: 'a9' } ]


 */
