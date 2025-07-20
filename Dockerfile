FROM node:18-alpine

# Install build dependencies required for native modules
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package* ./
RUN npm install

COPY . .
EXPOSE 5000

CMD [ "npm", "start" ]