.PHONY: clean test test-watch test-coverage show-coverage coverage npm fmt depchart

clean:
	rm -rf npm build .nyc_output coverage *.bundle.js cov.lcov coverage_html cov_profile node_modules

example:
	deno run example.ts

test:
	deno test src

test-watch:
	deno test --watch src

test-coverage:
	deno test --no-check --coverage=cov_profile src

# to get "genhtml", run "sudo apt-get install lcov" (on linux) or "brew install lcov" (on mac)
show-coverage:
	deno coverage cov_profile --lcov > cov.lcov && genhtml -o cov_html cov.lcov

coverage: test-coverage show-coverage

npm:
	deno run --allow-all scripts/build_npm.ts $(VERSION)

fmt:
	deno fmt --options-indent-width=4 --options-line-width=100 src/ scripts/ example*.ts

depchart-simple:
	mkdir -p depchart && npx depchart `find src | grep .ts` --exclude src/test/*.ts --rankdir LR -o depchart/depchart-simple --node_modules omit

depchart-full:
	mkdir -p depchart && npx depchart example*.ts deps.ts mod.ts `find src | grep .ts` --rankdir LR -o depchart/depchart-full --node_modules integrated

depchart: depchart-simple depchart-full
