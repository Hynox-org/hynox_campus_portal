#!/bin/sh
mkdir -p /tmp/work
cp /box/solution.py /tmp/work/solution.py
cd /tmp/work
timeout "${TIME_LIMIT_SEC:-10}" python3 solution.py < /box/input.txt
exit $?
