FROM node:22-bookworm-slim AS base
WORKDIR /app
COPY --chown=node:node package.json server.js store.js core.js leagues.js provider.js imports.js analytics.js worker.js demo-ranking.js ./
COPY --chown=node:node public ./public
COPY --chown=node:node scripts ./scripts
RUN mkdir -p /app/data && chown node:node /app/data
USER node
ENV HOST=0.0.0.0 PORT=3000
EXPOSE 3000

FROM base AS test
COPY --chown=node:node test ./test
RUN npm test && node --check public/app.js

FROM base AS runtime
HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 CMD ["node","-e","fetch('http://127.0.0.1:3000/api/leagues').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node","server.js"]
