import express from 'express'
import bingoRoutes from './bingo.routes'

const router = express.Router()

router.use('/bingo', bingoRoutes)

export default router