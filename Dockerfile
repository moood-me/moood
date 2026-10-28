# moood's local player (player/README.md): the worlds and games of a folder mounted at /work, on port 8080; the plays
# kept in /data (a volume, to keep them past the container).
# (published: ghcr.io/moood-me/moood-player — player/README.md)
#   docker build -t moood-player .
#   docker run -v ./my-repo:/work -v moood-plays:/data -p 127.0.0.1:8080:8080 moood-player
# (voices and music from a studio's workshop: -e MOOOD_WORKSHOP=https://studio.moood.me [-e MOOOD_TOKEN=moood_…])
FROM node:22-alpine
WORKDIR /moood
COPY engines engines
COPY scene scene
COPY play play
COPY i18n i18n
COPY player player
COPY packages/check/package.json packages/check/repository.js packages/check/
COPY packages/check/problems packages/check/problems
ENV PORT=8080 MOOOD_BIND=0.0.0.0 MOOOD_DATA=/data
RUN mkdir /data && chown node /data
USER node
EXPOSE 8080
CMD ["node", "player/server.js", "/work"]
