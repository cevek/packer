import {Plugin} from "./Plugin";
export function conditional(cond: () => boolean) {
    return (plugin: (plug: Plugin)=>Promise<Plugin>) => {
        return (plug: Plugin) => {
            if (cond()) {
                return plugin(plug);
            } else {
                return plug;
            }
        };
    }
}