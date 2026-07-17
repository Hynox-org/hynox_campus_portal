FROM gcc:13-bookworm
RUN useradd -m -u 1000 sandbox
COPY entrypoint-c.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
USER sandbox
ENTRYPOINT ["/entrypoint.sh"]
