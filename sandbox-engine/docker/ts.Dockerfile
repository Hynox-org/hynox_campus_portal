FROM node:22-alpine
RUN apk add --no-cache coreutils
RUN npm install -g typescript
# Ambient @types/node (for require/process/etc) installed once at build time into a
# read-only location; entrypoint points tsc at it via --typeRoots since /tmp/work
# (where the student's file gets compiled) is a fresh tmpfs with no node_modules of its own.
RUN mkdir -p /opt/tsproj && cd /opt/tsproj && npm init -y > /dev/null 2>&1 && npm install --no-save @types/node > /dev/null 2>&1
COPY entrypoint-ts.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
USER node
ENTRYPOINT ["/entrypoint.sh"]
