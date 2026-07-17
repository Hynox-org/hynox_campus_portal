#!/bin/sh
mkdir -p /tmp/work
cp /box/solution.js /tmp/work/solution.js
cd /tmp/work
timeout "${TIME_LIMIT_SEC:-10}" node solution.js < /box/input.txt
exit $?
