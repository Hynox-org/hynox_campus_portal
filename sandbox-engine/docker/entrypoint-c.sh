#!/bin/sh
mkdir -p /tmp/work
cp /box/solution.c /tmp/work/solution.c
cd /tmp/work
gcc solution.c -O2 -o solution 2> compile_err.log
if [ $? -ne 0 ]; then
  cat compile_err.log >&2
  exit 100
fi
timeout "${TIME_LIMIT_SEC:-10}" ./solution < /box/input.txt
exit $?
