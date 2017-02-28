import {Plugin} from "../Plugin";
import path = require('path');

interface Cache {
    resolved: Map<string, string>;
    parentDirs: Map<string, string[]>
    nodeModules: Map<string, string[]>
    redirectModules: Map<string, Map<string, string>>;
    mainPkg: Map<string, string>;
}

const localModuleRegexp = /^(?:\.\.?(?:\/|$)|\/|([A-Za-z]:)?[\\\/])/;
export async function resolve(x: string, baseDir: string, plug: Plugin) {
    const cache = plug.getCache('resolver') as Cache;
    if (!cache.resolved) {
        cache.resolved = new Map();
        cache.parentDirs = new Map();
        cache.nodeModules = new Map();
        cache.redirectModules = new Map();
        cache.mainPkg = new Map();
    }
    let module = cache.resolved.get(x);
    if (module) {
        return module;
    }
    if (core[x]) {
        return '%core%';
    }

    let isLocalModule = localModuleRegexp.test(x);
    if (isLocalModule) {
        x = path.resolve(baseDir, x);
        if (x === '..') x += '/';
    }
    // console.log('xxxxxx', x);

    const currentModuleMain = await getCurrentModuleMain(baseDir, plug, cache);
    // console.log('current', currentModuleMain);
    const currentModuleRedirects = cache.redirectModules.get(currentModuleMain);
    if (currentModuleRedirects) {
        const r = currentModuleRedirects.get(x);
        if (r) {
            x = r;
            isLocalModule = localModuleRegexp.test(x);
        }
        else if (r === null) {
            return "%skip%";
        }
    }

    if (isLocalModule) {
        const m = await loadAsFile(x, plug, cache) || await loadAsDirectory(x, plug, cache);
        if (m) {
            cache.resolved.set(x, m);
            return m;
        }
    } else {
        const m = await loadNodeModules(x, baseDir, plug, cache);
        if (m) {
            cache.resolved.set(x, m);
            return m;
        }
    }
    return null;
}

async function loadAsFile(module: string, plug: Plugin, cache: Cache): Promise<string> {
    let file = await plug.fs.tryFile(module);
    if (file && !file.isDir) {
        return module;
    }
    module += '.js';
    file = await plug.fs.tryFile(module);
    if (file && !file.isDir) {
        return module;
    }
    return null;
}

async function loadAsDirectory(module: string, plug: Plugin, cache: Cache): Promise<string> {
    const mainFile = await loadMainFromPackageJson(module, plug, cache);
    if (mainFile) {
        const m = await loadAsFile(path.resolve(module, mainFile), plug, cache) || await loadAsDirectory(path.resolve(module, mainFile), plug, cache);
        if (m) return m;
    }
    return loadAsFile(path.join(module, '/index'), plug, cache);
}

async function loadMainFromPackageJson(module: string, plug: Plugin, cache: Cache) {
    const pkgFilename = module + '/package.json';
    const mainFile = cache.mainPkg.get(pkgFilename);
    if (mainFile || mainFile === null) {
        return mainFile;
    }
    const pkgFile = await plug.fs.tryFile(pkgFilename);
    if (pkgFile && !pkgFile.isDir) {
        const body = await plug.fs.readContent(pkgFile);
        const pkg = JSON.parse(body);
        let mainFile = pkg.main || 'index';
        let rm = cache.redirectModules.get(module);
        if (!rm) {
            rm = new Map();
            cache.redirectModules.set(module, rm);
        }
        if (!plug.nodeEnv && pkg.browser) {
            if (typeof pkg.browser === 'string') {
                mainFile = pkg.browser;
            }
            else if (typeof pkg.browser === 'object') {
                for (const m in pkg.browser) {
                    let key = m;
                    let val = pkg.browser[m];
                    if (localModuleRegexp.test(key)) {
                        key = path.resolve(module, key);
                    }
                    if (localModuleRegexp.test(val)) {
                        val = path.resolve(module, val);
                    }
                    // console.log(m, key, val);
                    if (val === false) {
                        rm.set(key, null);
                    } else {
                        rm.set(key, val);
                    }
                }
            }
        }
        cache.mainPkg.set(pkgFilename, mainFile);
        return mainFile;
    }
    cache.mainPkg.set(pkgFilename, null);
    return null;
}


async function loadNodeModules(module: string, start: string, plug: Plugin, cache: Cache) {
    const dirs = nodeModulesPaths(start, plug, cache);
    for (let i = 0; i < dirs.length; i++) {
        const dir = dirs[i] + '/' + module;
        const m = await loadAsFile(dir, plug, cache) || await loadAsDirectory(dir, plug, cache);
        if (m) {
            // console.log('nm', module, start, m);
            return m;
        }
    }
}


async function getCurrentModuleMain(currentDir: string, plug: Plugin, cache: Cache) {
    const dirs = parentDirs(currentDir, plug, cache);
    for (let i = 0; i < dirs.length; i++) {
        const dir = dirs[i];
        const m = await loadMainFromPackageJson(dir, plug, cache);
        if (m) {
            return dir;
        }
    }
    return null;
}


const splitRe = process.platform === 'win32' ? /[\/\\]/ : /\/+/;

function parentDirs(startPath: string, plug: Plugin, cache: Cache) {
    startPath = path.resolve(startPath);
    let dirs = cache.parentDirs.get(startPath);
    if (dirs) {
        return dirs;
    }
    let prefix = '';
    if (/^([A-Za-z]:)/.test(startPath)) {
        prefix = '';
    } else if (/^\\\\/.test(startPath)) {
        prefix = '\\\\';
    }

    const parts = startPath.split(splitRe);
    let dir = prefix;

    dirs = [];
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (/\/node_modules\//.test(part)) continue;
        dir += parts[i];
        dirs.push(dir);
        dir += '/';
    }
    dirs.reverse();
    cache.parentDirs.set(startPath, dirs);
    return dirs;
}

function nodeModulesPaths(startPath: string, plug: Plugin, cache: Cache) {
    startPath = path.resolve(startPath);
    let nmDirs = cache.nodeModules.get(startPath);
    if (nmDirs) {
        return nmDirs;
    }
    const dirs = parentDirs(startPath, plug, cache);
    nmDirs = new Array(dirs.length);
    for (let i = 0; i < dirs.length; i++) {
        const dir = dirs[i];
        nmDirs[i] = dir + '/node_modules';
    }
    cache.nodeModules.set(startPath, nmDirs);
    return nmDirs;
}

const core:{[k:string]:number} = {"assert":1,"buffer_ieee754":1,"buffer":1,"child_process":1,"cluster":1,"console":1,"constants":1,"crypto":1,"_debugger":1,"dgram":1,"dns":1,"domain":1,"events":1,"freelist":1,"fs":1,"http":1,"https":1,"_linklist":1,"module":1,"net":1,"os":1,"path":1,"punycode":1,"querystring":1,"readline":1,"repl":1,"stream":1,"string_decoder":1,"sys":1,"timers":1,"tls":1,"tty":1,"url":1,"util":1,"vm":1,"zlib":1}
