import {Plugin} from "../Plugin";
import path = require('path');

interface Cache {
    resolved: Map<string, string>;
    parentDirs: Map<string, string[]>
    nodeModules: Map<string, string[]>
    redirectModules: Map<string, Map<string, string>>;
}

const localModuleRegexp = /^(?:\.\.?(?:\/|$)|\/|([A-Za-z]:)?[\\\/])/;
export async function resolve(x: string, baseDir: string, plug: Plugin) {
    const cache = plug.getCache('resolver') as Cache;
    if (!cache.resolved) {
        cache.resolved = new Map();
        cache.parentDirs = new Map();
        cache.nodeModules = new Map();
        cache.redirectModules = new Map();
    }
    let module = cache.resolved.get(x);
    if (module) {
        return module;
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
            isLocalModule = true;
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
    const pkgFile = await plug.fs.tryFile(module + '/package.json');
    if (pkgFile && !pkgFile.isDir) {
        const body = await plug.fs.readContent(pkgFile);
        const pkg = JSON.parse(body);
        let mainFile = pkg.main || 'index';
        if (typeof pkg.browser === 'string') {
            mainFile = pkg.browser;
        }
        let rm = cache.redirectModules.get(module);
        if (!rm) {
            rm = new Map();
            cache.redirectModules.set(module, rm);
        }
        if (pkg.browser && typeof pkg.browser === 'object') {
            for (const m in pkg.browser) {
                const val = pkg.browser[m];
                const key = localModuleRegexp.test(m) ? path.resolve(module, m) : m;
                if (val === false) {
                    rm.set(key, null);
                } else {
                    rm.set(key, path.resolve(module, val));
                }
            }
            // console.log('rm', module, pkg.browser, rm);
        }
        return mainFile;
    }
    return null;
}


async function loadNodeModules(module: string, start: string, plug: Plugin, cache: Cache) {
    const dirs = nodeModulesPaths(start, cache);
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
    const dirs = parentDirs(currentDir, cache);
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

function parentDirs(startPath: string, cache: Cache) {
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

function nodeModulesPaths(startPath: string, cache: Cache) {
    startPath = path.resolve(startPath);
    let nmDirs = cache.nodeModules.get(startPath);
    if (nmDirs) {
        return nmDirs;
    }
    const dirs = parentDirs(startPath, cache);
    nmDirs = new Array(dirs.length);
    for (let i = 0; i < dirs.length; i++) {
        const dir = dirs[i];
        nmDirs[i] = dir + '/node_modules';
    }
    cache.nodeModules.set(startPath, nmDirs);
    return nmDirs;
}
