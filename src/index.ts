import {Packer} from './packer';
import {ts} from './plugins/ts';
import {combineJS} from './plugins/combineJS';
import {dest} from './plugins/dest';
import {combineCSS} from './plugins/combineCSS';
import {sass} from './plugins/sass';
import {jsEntry} from './plugins/jsEntry';
import {hmr} from './plugins/hmr';
import {copy} from './plugins/copy';
import {conditional} from './utils/conditional';


// const prodOnly = conditional(() => process.env.NODE_ENV == 'production');
const prodOnly = conditional(() => true);
new Packer({dest: 'dist', context: __dirname + '/../src/'}, promise => promise
        .then(ts())
        .then(jsEntry('src/index.js'))
        // .then(hmr())
        // .then(copy('test/*.js'))
        // .then(jsEntry('test/r.js'))
        .then(prodOnly(copy('index.html')))
        // .then(sass('index.scss'))
        .then(combineJS('bundle.js'))
        // .then(combineCSS('style.css'))
        .then(dest())
    /*
     .then(postcss())
     .then(combineJS('dist/vendor.js', ['react', 'mobx']))
     .then(combineCSS('dist/style.css'))
     .then(hash())
     .then(jade())
     .then(dest())*/
).watch(() => {
    
});


const unhandledRejections = new Map();
process.on('unhandledRejection', (reason: any, p: any) => {
    console.error(reason.stack);
    unhandledRejections.set(p, reason);
});
process.on('rejectionHandled', (p: any) => {
    unhandledRejections.delete(p);
});
