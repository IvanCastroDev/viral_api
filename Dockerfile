FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./

RUN npm install

RUN npm run build

COPY src/auth/*.json src/auth/

COPY . .

EXPOSE 8080

CMD ["npm", "start"]