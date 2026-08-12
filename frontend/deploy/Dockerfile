# Production image for Google Cloud Run (Nitro node-server output from CI_GCP=1 build).
# Build context must include `.output/` (run `CI_GCP=1 npm run build` first).
FROM node:22-alpine
WORKDIR /srv
ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0
COPY .output/ ./
# Removed local data bundling as we now fetch from GCS.
RUN mkdir -p aud corpus
ENV CORPUS_ROOT=/srv/corpus
ENV AUD_ROOT=/srv/aud
EXPOSE 8080
CMD ["node", "server/index.mjs"]
