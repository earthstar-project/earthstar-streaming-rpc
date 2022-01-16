import { build } from "https://deno.land/x/dnt@0.16.0/mod.ts";

await Deno.remove("npm", { recursive: true }).catch((_) => {});

await build({
    entryPoints: ["./mod.ts", "./src/entries/node.ts"],
    outDir: "./npm",
    shims: {
        deno: {
            test: "dev",
        },
        weakRef: true,
        customDev: [
            {
                globalNames: [],
            },
        ],
    },
    compilerOptions: {
        // This is for Node v14 support
        target: "ES2020",
    },
    mappings: {
        "https://deno.land/x/crayon_chalk_aliases@1.1.0/index.ts": {
            name: "chalk",
            version: "4.1.2",
        },
        "https://cdn.skypack.dev/concurrency-friends@5.2.0?dts": {
            name: "concurrency-friends",
            version: "5.2.0",
        },
    },
    package: {
        // package.json properties
        name: "earthstar-streaming-rpc",
        version: Deno.args[0],
        description: "Like JSON-RPC but also supports streaming",
        license: "LGPL-3.0-only",
        repository: {
            type: "git",
            url: "git+https://github.com/earthstar-project/earthstar-streaming-rpc.git",
        },
        bugs: {
            url: "https://github.com/earthstar-project/earthstar-streaming-rpc/issues",
        },
    },
    // tsc includes 'dom' as a lib, so doesn't need IndexedDB types
    redirects: {
        "./src/storage/indexeddb-types.deno.d.ts": "./src/storage/indexeddb-types.node.d.ts",
    },
});

// post build steps
Deno.copyFileSync("LICENSE", "npm/LICENSE");
Deno.copyFileSync("README.md", "npm/README.md");
