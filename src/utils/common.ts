export function formatBytes(bytes: number) {
    const kb = bytes / 1024;
    if (kb >= 1024) {
        return (kb / 1024).toFixed(2) + ' MB';
    }
    return Math.round(Math.max(kb, 1)) + ' kB';
}

export function padLeft(value: string | number, size: number, sym: string = ' ') {
    let s = value + '';
    while (s.length < size) {
        s = sym + s;
    }
    return s;
}

export function padRight(value: string | number, size: number, sym: string = ' ') {
    let s = value + '';
    while (s.length < size) {
        s = s + sym;
    }
    return s;
}