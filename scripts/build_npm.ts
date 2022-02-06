import { build, emptyDir } from 'https://deno.land/x/dnt@0.17.0/mod.ts';

await emptyDir('npm');

await build({
    entryPoints: [
        './mod.node.ts',
    ],
    outDir: './npm',
    //typeCheck: false,
    shims: {
        deno: true,
        weakRef: true,
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
        customDev: [
            {
                package: {
                    name: '@types/express',
                    version: '4.17.2',
                },

                globalNames: [],
            },
        ],
    },
    mappings: {
        'https://esm.sh/express@4.17.2?dts': {
            name: 'express',
            version: '4.17.2',
        },
    },
    redirects: {
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
    },
});

// post build steps
Deno.copyFileSync('LICENSE', 'npm/LICENSE');
Deno.copyFileSync('README.md', 'npm/README.md');
