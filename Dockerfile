FROM node:20-alpine

WORKDIR /app
COPY package.json ./
RUN npm install --only=production

COPY server.js ./

ENV PORT=8088
EXPOSE 8088

CMD ["node", "server.js"]
