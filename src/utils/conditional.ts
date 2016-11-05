import {Plug} from "./Plugin";
export function conditional(cond: () => boolean) {
    return (plugin: (plug: Plug)=>Promise<Plug>) => {
        return (plug: Plug) => {
            if (cond()) {
                return plugin(plug);
            }
        };
    }
}