FROM node:24-alpine
RUN apk add --no-cache su-exec
WORKDIR /app
COPY --chown=node:node . .
RUN chmod +x /app/entrypoint.sh && mkdir -p /data && chown node:node /data
ENV NODE_ENV=production DATA_DIR=/data PORT=3000
EXPOSE 3000
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["node", "src/server.js"]
