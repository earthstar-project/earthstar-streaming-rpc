.PHONY: clean example example-npm lint test test-watch test-coverage show-coverage coverage npm fmt depchart-simple depchart-full depchart

clean:
	rm -rf npm build .nyc_output coverage *.bundle.js cov.lcov coverage_html cov_profile node_modules

example:
	VERBOSE=true deno run --no-check=remote -A example.ts

example-npm:
	VERBOSE=true node npm/esm/example.js

lint:
	deno lint --rules-exclude=no-explicit-any,no-unused-vars,no-empty,no-inferrable-types,require-await *.ts scripts src

test:
	deno test -A --no-check=remote --unstable src

test-watch:
	deno test -A --no-check=remote --unstable --watch src

test-coverage:
	deno test -A --no-check=remote --unstable --coverage=cov_profile src

# to get "genhtml", run "sudo apt-get install lcov" (on linux) or "brew install lcov" (on mac)
show-coverage:
	deno coverage cov_profile --lcov > cov.lcov && genhtml -o cov_html cov.lcov

coverage: test-coverage show-coverage

npm:
	deno run -A scripts/build_npm.ts $(VERSION)

fmt:
	deno fmt --options-single-quote --options-indent-width=4 --options-line-width=100 src/ scripts/ example*.ts

depchart-simple:
	mkdir -p depchart && npx depchart `find src | grep .ts` --exclude src/test/*.ts src/log.ts --rankdir LR -o depchart/depchart-simple --node_modules omit

depchart-full:
	mkdir -p depchart && npx depchart example*.ts deps.ts mod.ts `find src | grep .ts` --rankdir LR -o depchart/depchart-full --node_modules integrated

depchart: depchart-simple depchart-full
