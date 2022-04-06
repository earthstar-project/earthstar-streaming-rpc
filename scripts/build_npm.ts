import { build, emptyDir } from 'https://deno.land/x/dnt@0.21.0/mod.ts';

await emptyDir('npm');

await build({
    entryPoints: [
        { name: '.', path: './src/entries/universal.ts' },
        { name: './node', path: './src/entries/node.ts' },
        { name: './browser', path: './src/entries/browser.ts' },
    ],
    outDir: './npm',
    shims: {
        deno: {
            test: 'dev',
        },
        weakRef: true,
        timers: true,
        custom: [
            {
                package: {
                    name: 'node-fetch',
                    version: '2.6.6',
                },
                typesPackage: {
                    name: '@types/node-fetch',
                    version: '2.5.12',
                },
                globalNames: [
                    { name: 'Headers', exportName: 'Headers' },
                    {
                        name: 'fetch',
                        exportName: 'default',
                    },
                    { name: 'Request', exportName: 'Request' },
                    { name: 'Response', exportName: 'Response' },
                ],
            },
            {
                package: {
                    name: '@sgwilym/urlpattern-polyfill',
                    version: '1.0.0-rc8',
                },
                globalNames: [{
                    name: 'URLPattern',
                    exportName: 'URLPattern',
                }],
            },
            {
                package: {
                    name: 'node-abort-controller',
                    version: '3.0.1',
                },
                globalNames: [{
                    name: 'AbortController',
                    exportName: 'AbortController',
                }],
            },
        ],
        customDev: [{
            package: {
                name: '@types/express',
                version: '4.17.2',
            },

            globalNames: [],
        }],
    },
    mappings: {
        'https://esm.sh/express@4.17.2?dts': {
            name: 'express',
            version: '4.17.2',
        },
        './src/test/scenarios.ts': './src/test/scenarios.node.ts',
    },
    compilerOptions: {
        // ES2020 for Node v14 support
        target: 'ES2020',
    },
    package: {
        // package.json properties
        name: 'earthstar-streaming-rpc',
        version: Deno.args[0],
        description: 'Like JSON-RPC but also supports streaming',
        license: 'LGPL-3.0-only',
        repository: {
            type: 'git',
            url: 'git+https://github.com/earthstar-project/earthstar-streaming-rpc.git',
        },
        bugs: {
            url: 'https://github.com/earthstar-project/earthstar-streaming-rpc/issues',
        },
        devDependencies: {
            '@types/express': '4.17.2',
            '@types/node-fetch': '2.5.12',
        },
        sideEffects: false,
    },
});

// post build steps
Deno.copyFileSync('LICENSE', 'npm/LICENSE');
Deno.copyFileSync('README.md', 'npm/README.md');

// A truly filthy hack to compensate for Typescript's lack of support for the exports field
Deno.writeTextFileSync(
    'npm/browser.js',
    `export * from "./esm/src/entries/browser.js";`,
);

Deno.writeTextFileSync(
    'npm/browser.d.ts',
    `export * from './types/src/entries/browser';`,
);

Deno.writeTextFileSync(
    'npm/node.js',
    `export * from "./esm/src/entries/node.js";`,
);

Deno.writeTextFileSync(
    'npm/node.d.ts',
    `export * from './types/src/entries/node';`,
);
