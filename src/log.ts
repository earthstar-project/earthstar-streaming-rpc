import { crayon } from '../deps.ts';

let showLogs = Deno.env.get('VERBOSE') === 'true';

export let logMain = (...args: any[]) => {
    if (showLogs) console.log(crayon.bgWhite.black(' main '), ...args);
};

export let logConnection = (...args: any[]) => {
    if (showLogs) {
        console.log('  ' + crayon.bgMagenta.black(' connection '), ...args);
    }
};

export let logTransport = (...args: any[]) => {
    if (showLogs) {
        console.log('    ' + crayon.bgCyan.black(' transport '), ...args);
    }
};
