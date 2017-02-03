import FastPromise from 'fast-promise';
function __awaiter(thisArg: any, _arguments: any, P: any, generator: any) {
    const promise = new FastPromise();
    step((generator = generator.apply(thisArg, _arguments)).next(), promise, generator);
    return promise;
}

interface ResultThis {
    promise: FastPromise<any>;
    generator: Iterator<any>;
}
function fulfilled(this: ResultThis, value: any) {
    try {
        step(this.generator.next(value), this.promise, this.generator);
    } catch (e) {
        this.promise.reject(e);
    }
}

function rejected(this: ResultThis, value: any) {
    try {
        step(this.generator.throw(value), this.promise, this.generator);
    } catch (e) {
        this.promise.reject(e);
    }
}

function step(result: any, promise: FastPromise<any>, generator: Iterator<any>) {
    result.done ? promise.resolve(result.value) : new FastPromise().resolve(result.value).then(fulfilled, rejected, {promise, generator});
}


function __awaiter3(thisArg: any, _arguments: any, P: any, generator: any) {
    return new (P || (P = Promise))(function (resolve:any, reject:any) {
        function fulfilled(value:any) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value:any) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result:any) { result.done ? resolve(result.value) : new P(function (resolve:any) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

(global as any).__awaiter = __awaiter;