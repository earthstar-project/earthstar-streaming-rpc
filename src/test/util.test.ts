import { assert, assertEquals } from "./asserts.ts";
import { makeId, randInt } from "../util.ts";

//================================================================================

Deno.test("randInt", () => {
    let passed = true;
    for (let ii = 0; ii < 1000; ii++) {
        const n = randInt(3, 5);
        if (n < 3 || n > 5) passed = false;
    }
    assert(passed, "randInt range is inclusive of endpoints");
});

Deno.test("makeId", () => {
    let passed = true;
    for (let ii = 0; ii < 1000; ii++) {
        if (makeId().length !== 15) passed = false;
    }
    assert(passed, "makeId is always 15 characters long");
});
