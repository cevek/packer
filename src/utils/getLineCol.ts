export function getLineCol(content: string, pos: number) {
    let i = 0;
    let line = 0;
    let col = 0;
    for (i = 0; i < content.length; i++) {
        col = 0;
        if (content.charCodeAt(i) === 10) {
            col++;
            line++;
        }
    }
    return {line, col};
}