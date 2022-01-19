import { crayon } from '../deps.ts';

export let logMain = (...args: any[]) => {
    console.log(crayon.bgWhite.black(' main '), ...args);
};

export let logConnection = (...args: any[]) => {
    console.log('  ' + crayon.bgMagenta.black(' connection '), ...args);
};

export let logTransport = (...args: any[]) => {
    console.log('    ' + crayon.bgCyan.black(' transport '), ...args);
};
