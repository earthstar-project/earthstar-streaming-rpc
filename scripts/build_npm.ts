import { build } from 'https://deno.land/x/dnt@0.16.0/mod.ts';

await Deno.remove('npm', { recursive: true }).catch((_) => {});

await build({
    entryPoints: ['./mod.ts', './example.ts'],
    outDir: './npm',
    shims: {
        deno: true,
        weakRef: true,
        custom: [
            {
                package: {
                    name: 'cross-fetch',
                    version: '~3.1.4',
                },
                globalNames: [{
                    name: 'fetch',
                    exportName: 'default',
                }],
            },
            {
                package: {
                    name: 'web-streams-polyfill',
                    version: '~3.2.0',
                },
                globalNames: [{
                    name: 'ReadableStream',
                }],
            },
        ],
    },
    compilerOptions: {
        // This is for Node v14 support
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
