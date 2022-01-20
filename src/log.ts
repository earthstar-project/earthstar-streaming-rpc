import { crayon } from '../deps.ts';

const showLogs = Deno.env.get('VERBOSE') === 'true';

export const logMain = (...args: any[]) => {
    if (showLogs) console.log(crayon.bgWhite.black(' main '), ...args);
};

export const logConnection = (...args: any[]) => {
    if (showLogs) {
        console.log('  ' + crayon.bgMagenta.black(' connection '), ...args);
    }
};

export const logTransport = (...args: any[]) => {
    if (showLogs) {
        console.log('    ' + crayon.bgCyan.black(' transport '), ...args);
    }
};
