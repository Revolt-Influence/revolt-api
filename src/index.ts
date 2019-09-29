// Get dependencies
import Koa from 'koa'
import Router from 'koa-router'
import cors from '@koa/cors'
import bodyParser from 'koa-bodyparser'
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import session from 'koa-session'
import socketIo from 'socket.io'
import http from 'http'
import { ApolloServer } from 'apollo-server-koa'
import 'reflect-metadata'
import { buildSchema } from 'type-graphql'
import { passport } from './features/session'
import { handleGlobalErrors } from './utils/errors'
import { socketEvents } from './utils/sockets'
import { UserResolver } from './features/user/resolver'
import { CreatorResolver } from './features/creator/resolver'
import { CampaignResolver } from './features/campaign/resolver'
import { ConversationResolver } from './features/conversation/resolver'
import { BrandResolver } from './features/brand/resolver'
import { CollabResolver } from './features/collab/resolver'
import { SessionResolver } from './features/session/resolver'
import { YoutuberResolver } from './features/youtuber/resolver'
import { MyContext, Session } from './features/session/model'
import { customAuthChecker } from './middleware/auth'

async function main(): Promise<void> {
  // Create instances and configs./middleware/auth
  const app = new Koa<Session, MyContext>()
  const server = http.createServer(app.callback())
  const io = socketIo(server)
  app.context.io = io // Attach socket.io to context for easy access
  const router = new Router()
  dotenv.config()
  const sessionConfig = { maxAge: 86400000 * 7, renew: true } // Week-long and renewed sessions

  // Connect database
  const mongoURI = process.env.DB_URI
  console.log(process.env.NODE_ENV.toUpperCase())
  await mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
  })

  // Settings
  const PORT = process.env.PORT || 5000
  app.keys = ['my-cool-key']

  // Setup GraphQL schema
  const schema = await buildSchema({
    resolvers: [
      BrandResolver,
      CreatorResolver,
      CampaignResolver,
      ConversationResolver,
      CollabResolver,
      UserResolver,
      SessionResolver,
      YoutuberResolver,
    ],
    authChecker: customAuthChecker,
  })

  // Top level routing
  router.get('/', ctx => (ctx.body = 'revolt-graphql is up --- 1.0.0'))

  // Middleware
  app.use(cors({ origin: process.env.APP_URL, credentials: true }))
  app.use(handleGlobalErrors)
  app.use(bodyParser())
  app.use(session(sessionConfig, app))
  app.use(passport.initialize())
  app.use(passport.session())

  // Create Apollo Server instance
  const apolloServer = new ApolloServer({
    schema,
    context: ({ ctx }: { ctx: Koa.ParameterizedContext<Session, MyContext> }) => ctx,
  })
  // Link Apollo server and Koa app
  apolloServer.applyMiddleware({ app })

  io.on('connection', socket => {
    socket.on(socketEvents.JOIN_ROOM, roomId => {
      socket.join(roomId)
    })
  })

  // Open the server to the world
  server.listen(PORT)

  // Say hello
  console.log(`Listening on port ${PORT}`)
}

// Start server
main()
