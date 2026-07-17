FROM eclipse-temurin:21-jdk-alpine
RUN apk add --no-cache coreutils
RUN adduser -D -u 1000 sandbox
COPY entrypoint-java.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
USER sandbox
ENTRYPOINT ["/entrypoint.sh"]
