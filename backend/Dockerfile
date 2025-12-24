FROM node:18-alpine
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

ENV PORT=3000
EXPOSE 3000

CMD ["node", "src/server.js"]
