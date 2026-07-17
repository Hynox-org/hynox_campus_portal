#!/bin/sh
mkdir -p /tmp/work
cp /box/solution.ts /tmp/work/solution.ts
cd /tmp/work
tsc solution.ts --target es2020 --module commonjs --outDir . --typeRoots /opt/tsproj/node_modules/@types --types node 2> compile_err.log
if [ $? -ne 0 ]; then
  cat compile_err.log >&2
  exit 100
fi
timeout "${TIME_LIMIT_SEC:-10}" node solution.js < /box/input.txt
exit $?
