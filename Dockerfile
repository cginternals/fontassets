FROM llassetgen-cmd

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

# TMP
RUN mkdir /output

EXPOSE $PORT
CMD [ "npm", "start" ]
