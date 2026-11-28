FROM node:22-bookworm-slim
WORKDIR /srv/review
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --chown=node:node server.cjs identity.js launch.js revision ./
COPY --chown=node:node build/ ./build/
USER node
CMD ["node", "server.cjs"]
