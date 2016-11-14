import FastPromise from 'fast-promise';
function __awaiter(thisArg: any, _arguments: any, P: any, generator: any) {
    const promise = new FastPromise();
    function fulfilled(value: any) {
        try {
            step(generator.next(value));
        } catch (e) {
            promise.reject(e);
        }
    }

    function rejected(value: any) {
        try {
            step(generator.throw(value));
        } catch (e) {
            promise.reject(e);
        }
    }

    function step(result: any) {
        result.done ? promise.resolve(result.value) : FastPromise.resolve(result.value).then(fulfilled, rejected);
    }

    step((generator = generator.apply(thisArg, _arguments)).next());

    return promise;
}

(global as any).__awaiter = __awaiter;