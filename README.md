# openll-asset-server

*WORK IN PROGRESS*

Small web service that wraps the [openll-asset-generator](https://github.com/cginternals/openll-asset-generator) CLI as a REST API. Written in TypeScript, using Express.js.

Beta version: https://fontassets.io/

## Getting started
* Clone https://github.com/cginternals/openll-asset-generator/compare/develop...bwasty:docker
  - change to the directory and run `./build_docker.sh` (result: local docker image `llassetgen-cmd`)
* `npm install`
* `npm run dev`
* open http://localhost:3000/

## Deployment
* Local test / generic Docker deployment
    * `docker build . -t openll-asset-server`
    * `docker run -e PORT=3001 -p 3001:3001 openll-asset-server`
    * open http://localhost:3001/

