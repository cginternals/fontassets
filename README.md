# openll-asset-server

Small web service that wraps the [openll-asset-generator](https://github.com/cginternals/openll-asset-generator) CLI as a REST API. Written in TypeScript, using Express.js.

## Getting started
* Clone https://github.com/cginternals/openll-asset-generator/compare/develop...bwasty:docker
  - run `./build_docker` (result: local docker image `llassetgen-cmd`)
* `npm install`
* `npm run dev`
* open http://localhost:3000/
