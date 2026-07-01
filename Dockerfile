FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

RUN ls -la
RUN ls -la dist

EXPOSE 3000

CMD ["npm", "run", "start:prod"]