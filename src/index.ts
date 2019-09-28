// Get dependencies
import * as Koa from 'koa'
import * as Router from 'koa-router'
import * as cors from '@koa/cors'
import * as bodyParser from 'koa-bodyparser'
import * as morgan from 'koa-morgan'
import * as mongoose from 'mongoose'
import * as dotenv from 'dotenv'
import * as session from 'koa-session'
import * as socketIo from 'socket.io'
import * as http from 'http'
import { ApolloServer } from 'apollo-server-koa'
import 'reflect-metadata'
import { buildSchema } from 'type-graphql'
import sessionRouter from './features/session/router'
// import campaignRouter from './features/campaign/router'
import userRouter from './features/user/router'
import creatorRouter from './features/creator/router'
import collabRouter from './features/collab/router'
import youtubeRouter from './features/youtuber/router'
import conversationRouter from './features/conversation/router'
import { passport } from './features/session'
import { handleGlobalErrors } from './utils/errors'
import { socketEvents } from './utils/sockets'
import { UserResolver } from './features/user/resolver'
import CampaignResolver from './features/campaign/resolver'
import { MyContext, Session } from './features/session/model'

async function main(): Promise<void> {
  // Create instances and configs
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
    resolvers: [UserResolver, CampaignResolver],
  })

  // Create Apollo Server instance
  const apolloServer = new ApolloServer({
    schema,
    context: ({ ctx }: { ctx: Koa.ParameterizedContext<Session, MyContext> }) => ctx,
  })
  // Start Koa app
  // Link server and app
  apolloServer.applyMiddleware({ app })

  // Top level routing
  router.get('/', ctx => (ctx.body = 'revolt-graphql is up --- 1.0.0'))
  router.use('/session', sessionRouter.routes())
  router.use('/creators', creatorRouter.routes())
  router.use('/user', userRouter.routes())
  // router.use('/campaigns', campaignRouter.routes())
  router.use('/collab', collabRouter.routes())
  router.use('/youtuber', youtubeRouter.routes())
  router.use('/conversations', conversationRouter.routes())

  // Middleware
  app.use(cors({ origin: process.env.APP_URL, credentials: true }))
  app.use(morgan('dev'))
  app.use(handleGlobalErrors)
  app.use(bodyParser())
  app.use(session(sessionConfig, app))
  app.use(passport.initialize())
  app.use(passport.session())
  app.use(router.routes())

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
