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
3. [Install MongoDB](https://treehouse.github.io/installation-guides/mac/mongo-mac.html) (`brew update` then `brew install mongodb`) and run it locally
4. `cp .env.sample .env` and use your variables, including your Mongo instance

## Commands

* `npm run dev` : Start the app in development mode, reloads on changes (may need [some configuration](https://stackoverflow.com/a/45004802/3661792) on macOS)
* `npm run start` : Start the app in production. Called by Heroku
* `npm run build`: Compile the app to a `build/server.js` file
* `npm run test` : Run all tests
* `npm run debug` : Run all tests in watch mode with logs, best for debugging
