FROM node:16.10.0-buster

COPY . /usr/src/App
WORKDIR /usr/src/App

RUN npm install
RUN npm install -g nodemon

EXPOSE 8080

CMD ["nodemon", "server.js"]

