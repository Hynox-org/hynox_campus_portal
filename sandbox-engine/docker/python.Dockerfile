FROM python:3.12-alpine
RUN apk add --no-cache coreutils
RUN adduser -D -u 1000 sandbox
COPY entrypoint-python.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
USER sandbox
ENTRYPOINT ["/entrypoint.sh"]
