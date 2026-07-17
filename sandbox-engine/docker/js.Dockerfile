FROM node:22-alpine
RUN apk add --no-cache coreutils
COPY entrypoint-js.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
USER node
ENTRYPOINT ["/entrypoint.sh"]
