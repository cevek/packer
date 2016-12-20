import {Plugin} from "./Plugin";
import FastPromise from "fast-promise";
export function conditional(cond: () => boolean) {
    return (plugin: (plug: Plugin)=>Promise<Plugin>) => {
        return (plug: Plugin) => {
            if (cond()) {
                return plugin(plug);
            } else {
                return FastPromise.resolve(plug);
            }
        };
    }
}