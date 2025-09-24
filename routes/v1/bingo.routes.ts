import express from 'express'
import * as controller from '@/controllers'

const router = express.Router()

router.route('/create-room').post(controller.v1.bingoController.createRoom)
router.route('/join-room').post(controller.v1.bingoController.joinRoom)
router.route('/start-game').post(controller.v1.bingoController.startGame)
router.route('/players/:roomId').get(controller.v1.bingoController.roomPlayers)
router.route('/propose-number').post(controller.v1.bingoController.proposeNumber)
router.route('/confirm-proposal').post(controller.v1.bingoController.confirmProposal)
router.route('/call-bingo').post(controller.v1.bingoController.callBingo)
router.route('/strike').post(controller.v1.bingoController.strike)

router.route('/room/:roomId/state').get(controller.v1.bingoController.getRoomState)
router.route('/room/:roomId/info').get(controller.v1.bingoController.getRoomInfo)

export default router
