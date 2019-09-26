# revolt-graphql

>[View on Github](https://github.com/remi2j/revolt-graphql)
>
>Back-end of the [app.revoltgaming.co](https://app.revoltgaming.co) app.
>
>Hosted by Heroku at [api.revoltgaming.co](https://api.revoltgaming.co)
>
>Find the front-end on [this repo](https://github.com/remi2j/revolt-webapp).

## Installation

1. `git clone https://github.com/remi2j/revolt-graphql.git`
2. `yarn install`
3. `cp .env.sample .env` and use your variables
4. [Install MongoDB](https://treehouse.github.io/installation-guides/mac/mongo-mac.html) (`brew update` then `brew install mongodb`)
5. Create database folder: `mkdir -p <MONGO_PATH>` (<MONGO_PATH> can be anything, but leave it out of this directory)
6. Check if Mongo has the right authorizations: ```sudo chown -R `id -un` /data/db```
7. Create a file named `.env` at the root of this folder, and enter `DB_HOST=localhost:27017`
8. Run `mongod --port 27017 -dbpath <MONGO_PATH>`

## Commands

* `npm run dev` : Start the app in development mode, reloads on changes (may need [some configuration](https://stackoverflow.com/a/45004802/3661792) on macOS)
* `npm run start` : Start the app in production. Called by Heroku
* `npm run build`: Compile the app to a `build/server.js` file
* `npm run test` : Run all tests
* `npm run debug` : Run all tests in watch mode with logs, best for debugging
