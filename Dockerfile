
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --ignore-scripts
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production --ignore-scripts
COPY --from=builder /app/dist ./dist
EXPOSE 5000
CMD ["sh", "-c", "PORT=5000 node dist/index.js"]
