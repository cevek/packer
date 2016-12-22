const mime = require('mime-db');
const extensions: {[ext: string]: string} = {};
const keys = Object.keys(mime);
for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const exts = mime[key].extensions;
    if (exts) {
        for (let j = 0; j < exts.length; j++) {
            const ext = exts[j];
            extensions[ext] = key;
        }
    }
}
export function base64Url(ext: string, body: string | Buffer) {
    if (typeof body === 'string') {
        body = Buffer.from(body);
    }
    return `data:${extensions[ext] || 'application/octet-stream'};base64,${body.toString('base64')}`;
}