export function promisify<T>(func: (...args: any[])=>void, context?: any) {
    const fn = function (...args: any[]) {
        return new Promise<T>((resolve, reject) => {
            args.push((err: any, data: T) => {
                if (err) return reject(err);
                return resolve(data);
            });
            func.apply(context, args);
        });
    };
    (fn as any).displayName = (func as any).name;
    return fn;
}