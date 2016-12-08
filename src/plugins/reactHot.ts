import {plugin} from "../packer";
import {Plugin} from "../utils/Plugin";

export function reactHot() {
    return plugin('reactHot', async (plug: Plugin) => {
        // const rnd = Date.now();
        const file = plug.fs.createGeneratedFile(plug.options.context + '/react-hot.js', `
var deepForceUpdate = require('react-deep-force-update');
var reactDOM = require('react-dom');
var hostRender = reactDOM.render;
var rnd = 0; 
var instances = []; 
reactDOM.render = function render() {
    var result = hostRender.apply(this, arguments);
    instances.push(result);
    return result; 
}

function reactHotUpdater() {
    // console.log(x);
    //     console.info('React hot: components updating');
        for (var i = 0; i < instances.length; i++) {
            deepForceUpdate(instances[i]);
        }
        // console.info('React hot: components updated');
    // }
    setTimeout(reactHotUpdater, 1000);
}

setTimeout(reactHotUpdater, 1000);
`, null);
        await plug.jsScanner.scan(file);
        plug.jsEntries.unshift(file);
    });
}