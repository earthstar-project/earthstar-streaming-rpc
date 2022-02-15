import { crayon } from '../deps.ts';

let showLogs = false;

export function toggleLogs() {
    showLogs = !showLogs;
}

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

export const logTransport2 = (...args: any[]) => {
    if (showLogs) {
        console.log('    ' + crayon.bgLightBlue.black(' transport '), ...args);
    }
};

export const logWatchable = (...args: any[]) => {
    if (showLogs) {
        console.log(crayon.bgRed.black(' watchable '), ...args);
    }
};

export const logPullState = (...args: any[]) => {
    if (showLogs) {
        console.log('    ' + crayon.bgLightMagenta.black(' pull state '), ...args);
    }
};
