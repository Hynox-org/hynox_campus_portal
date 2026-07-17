#!/bin/sh
mkdir -p /tmp/work
cp /box/solution.java /tmp/work/Main.java
cd /tmp/work
javac Main.java 2> compile_err.log
if [ $? -ne 0 ]; then
  cat compile_err.log >&2
  exit 100
fi
timeout "${TIME_LIMIT_SEC:-10}" java -Xmx${JAVA_MEM_MB:-256}m Main < /box/input.txt
exit $?
