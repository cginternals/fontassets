FROM cginternals/openll-asset-generator:develop

RUN apt-get update && apt-get -y install wget gnupg
RUN wget -qO- https://deb.nodesource.com/setup_8.x | bash -
RUN apt-get install -y nodejs

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

COPY package.json .
COPY package-lock.json .
RUN npm install
COPY . .
RUN npm run build

# cache directory
RUN mkdir /output

ENV NODE_ENV=production
EXPOSE $PORT
CMD [ "npm", "start" ]
