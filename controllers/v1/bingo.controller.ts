import { Request, Response } from 'express'
import { Room } from '@/models'
import mongoose from 'mongoose'
import { nanoid } from 'nanoid'
import isEmpty from 'is-empty'
import { socketEmitToRoom } from '@/integrations/socket'
import { createBoard, strikeBingoLetter } from '@/utils/reUseableFunction'
import { checkBingoWithStrikes, validateColumnStrike, validateRowStrike } from '@/validations/strike-validation'

/** Create a room */
export const createRoom = async (req: Request, res: Response) => {
    try {
        const { name, boardType } = req.body
        const roomId = nanoid(8)
        const board = createBoard(boardType)
        const marked = board.map((r) => r.map(() => false))
        const strikes = {
            rows: new Array(5).fill(false),
            columns: new Array(boardType === '5x5' ? 5 : 10).fill(false),
        }

        const bingoWord = {
            B: false,
            I: false,
            N: false,
            G: false,
            O: false,
        }

        const player = {
            _id: new mongoose.Types.ObjectId(),
            name: name || 'Player1',
            boardType,
            board,
            marked,
            strikes,
            bingoWord,
        }

        const room = await Room.create({
            roomId,
            boardType,
            players: [player],
            turn: player._id,
            calledNumbers: [],
            started: false,
        })

        if (isEmpty(room)) return res.status(500).json({ success: false, message: 'Failed to create room' })

        return res.json({ success: true, message: 'Room created', data: { roomId, player } })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ success: false, message: 'Server error' })
    }
}

/** Join a room */
export const joinRoom = async (req: Request, res: Response) => {
    try {
        const { roomId, name } = req.body
        console.log('roomId: ', roomId)
        const room = await Room.findOne({ roomId })
        if (!room) return res.status(404).json({ success: false, message: 'Room not found' })
        if (room.players.length >= 2) return res.status(400).json({ success: false, message: 'Room full' })

        const board = createBoard(room.boardType as any)
        const marked = board.map((r) => r.map(() => false))
        const strikes = {
            rows: new Array(5).fill(false),
            columns: new Array(room.boardType === '5x5' ? 5 : 10).fill(false),
        }

        const bingoWord = {
            B: false,
            I: false,
            N: false,
            G: false,
            O: false,
        }

        const player = {
            _id: new mongoose.Types.ObjectId(),
            name: name || 'Player2',
            boardType: room.boardType,
            board,
            marked,
            strikes,
            bingoWord,
        }

        room.players.push(player as any)
        await room.save()

        socketEmitToRoom(roomId, 'playerJoined', { players: room.players })

        return res.json({ success: true, message: 'Joined room', data: { roomId, player } })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ success: false, message: 'Server error' })
    }
}

/** Start game */
export const startGame = async (req: Request, res: Response) => {
    try {
        const { roomId } = req.body
        const room = await Room.findOne({ roomId })
        if (!room) return res.status(404).json({ success: false, message: 'Room not found' })
        if (room.players.length < 2) return res.status(400).json({ success: false, message: 'Need 2 players' })

        room.started = true
        await room.save()

        socketEmitToRoom(room.roomId, 'gameStarted', {
            calledNumbers: room.calledNumbers,
            turn: room.turn,
            players: room.players.map((p) => ({ _id: p._id, name: p.name, strikes: p.strikes })),
        })

        return res.json({ success: true, message: 'Game started' })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ success: false, message: 'Server error' })
    }
}

/** Get room players */
export const roomPlayers = async (req: Request, res: Response) => {
    try {
        const { roomId } = req.params
        const room = await Room.findOne({ roomId })
        if (!room) return res.status(404).json({ success: false, message: 'Room not found' })
        return res.json({ success: true, data: room.players })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ success: false, message: 'Server error' })
    }
}

/** Propose number */
export const proposeNumber = async (req: Request, res: Response) => {
    try {
        const { roomId, playerId, number } = req.body
        const room = await Room.findOne({ roomId })
        if (!room) return res.status(404).json({ success: false, message: 'Room not found' })
        if (String(room.turn) !== String(playerId)) return res.status(400).json({ success: false, message: 'Not your turn' })
        if (room.pendingNumber) return res.status(400).json({ success: false, message: 'Pending number exists' })

        room.pendingNumber = number
        room.pendingBy = playerId
        await room.save()

        socketEmitToRoom(roomId, 'opponentProposed', { number, by: playerId })
        return res.json({ success: true })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ success: false, message: 'Server error' })
    }
}

/** Confirm proposal */
export const confirmProposal = async (req: Request, res: Response) => {
    try {
        const { roomId, playerId } = req.body
        const room = await Room.findOne({ roomId })
        if (!room) return res.status(404).json({ success: false, message: 'Room not found' })
        const pending = room.pendingNumber
        if (!pending) return res.status(400).json({ success: false, message: 'No pending number' })

        // Mark number for all players
        room.players.forEach((p) => {
            for (let r = 0; r < p.board.length; r++) {
                for (let c = 0; c < p.board[r].length; c++) {
                    if (p.board[r][c] === pending) p.marked[r][c] = true
                }
            }
        })

        room.calledNumbers.push(pending)
        room.pendingNumber = null
        room.pendingBy = null
        room.turn = playerId
        await room.save()

        socketEmitToRoom(roomId, 'proposalConfirmed', {
            number: pending,
            by: playerId,
            calledNumbers: room.calledNumbers,
            turn: room.turn,
            players: room.players.map((p) => ({ _id: p._id, marked: p.marked })),
        })

        return res.json({ success: true })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ success: false, message: 'Server error' })
    }
}

/** Call bingo */
export const callBingo = async (req: Request, res: Response) => {
    try {
        const { roomId, playerId } = req.body
        const room = await Room.findOne({ roomId })
        if (!room) return res.status(404).json({ success: false, message: 'Room not found' })

        const player = room.players.find((p) => String(p._id) === String(playerId))
        if (!player) return res.status(400).json({ success: false, message: 'Not in room' })

        const rows = player.marked
        const rowWin = rows.some((r) => r.every(Boolean))
        const colWin = rows[0].map((_, c) => rows.every((r) => r[c])).some(Boolean)
        const diag1 = rows.map((r, i) => r[i]).every(Boolean)
        const diag2 = rows.map((r, i) => r[r.length - 1 - i]).every(Boolean)

        if (rowWin || colWin || diag1 || diag2) {
            socketEmitToRoom(roomId, 'gameOver', { winner: playerId })
            return res.json({ success: true, winner: true })
        } else {
            return res.status(400).json({ success: false, message: 'Not a valid bingo' })
        }
    } catch (error) {
        console.error(error)
        return res.status(500).json({ success: false, message: 'Server error' })
    }
}

interface StrikeRequest extends Request {
    body: {
        roomId: string
        playerId: string
        type: 'row' | 'column'
        index: number
    }
}

export const strike = async (req: StrikeRequest, res: Response) => {
    try {
        const { roomId, playerId, type, index } = req.body

        if (!roomId || !playerId || !type || typeof index !== 'number') {
            return res.status(400).json({ success: false, message: 'Missing required fields: roomId, playerId, type, index' })
        }

        if (!['row', 'column'].includes(type)) {
            return res.status(400).json({ success: false, message: 'Type must be either "row" or "column"' })
        }

        const room = await Room.findOne({ roomId })
        if (!room) {
            return res.status(404).json({ success: false, message: 'Room not found' })
        }

        if (!room.started) {
            return res.status(400).json({ success: false, message: 'Game has not started yet' })
        }

        const playerIndex = room.players.findIndex((p) => p._id.toString() === playerId)
        if (playerIndex === -1) {
            return res.status(404).json({ success: false, message: 'Player not found in room' })
        }

        const player = room.players[playerIndex]

        let validation: { valid: boolean; message?: string }

        if (type === 'row') {
            validation = validateRowStrike(player, index)
        } else {
            validation = validateColumnStrike(player, index)
        }

        if (!validation.valid) {
            return res.status(400).json({ success: false, message: validation.message })
        }

        if (type === 'row') {
            room.players[playerIndex].strikes.rows[index] = true
        } else {
            room.players[playerIndex].strikes.columns[index] = true
        }

        const { updatedBingoWord, struckLetter } = strikeBingoLetter(room.players[playerIndex].bingoWord)
        room.players[playerIndex].bingoWord = updatedBingoWord

        const hasBingo = checkBingoWithStrikes(room.players[playerIndex])

        if (hasBingo) {
            room.gameStatus = 'completed'
            room.winner = player._id
        }

        await room.save()

        const responseData = {
            roomId: room.roomId,
            players: room.players.map((p) => ({
                _id: p._id,
                name: p.name,
                marked: p.marked,
                strikes: p.strikes,
                bingoWord: p.bingoWord,
                boardType: p.boardType,
            })),
            turn: room.turn,
            strikeType: type,
            strikeIndex: index,
            strikedBy: playerId,
            struckBingoLetter: struckLetter,
            hasBingo: hasBingo,
        }

        socketEmitToRoom(roomId, 'playerStruck', responseData)

        if (hasBingo) {
            socketEmitToRoom(roomId, 'gameOver', {
                winner: playerId,
                winnerName: player.name,
                reason: 'BINGO achieved',
            })
        }

        return res.status(200).json({
            success: true,
            message: `${type.charAt(0).toUpperCase() + type.slice(1)} ${index + 1} struck successfully${
                struckLetter ? ` and ${struckLetter} marked` : ''
            }`,
            data: responseData,
        })
    } catch (error) {
        console.error('Strike API Error:', error)
        return res.status(500).json({ success: false, message: 'Something went wrong' })
    }
}

interface GetRoomStateRequest extends Request {
    params: {
        roomId: string
    }
    query: {
        playerId?: string
    }
}

export const getRoomState = async (req: GetRoomStateRequest, res: Response) => {
    try {
        const { roomId } = req.params
        const { playerId } = req.query

        const room = await Room.findOne({ roomId })
        if (!room) {
            return res.status(404).json({ success: false, message: 'Room not found' })
        }

        let currentPlayer = null
        if (playerId) {
            currentPlayer = room.players.find((p) => p._id.toString() === playerId)

            if (!currentPlayer) {
                return res.status(403).json({ success: false, message: 'Player not found in this room' })
            }
        }

        const roomData = {
            _id: room._id,
            roomId: room.roomId,
            started: room.started,
            boardType: room.boardType,
            players: room.players.map((player) => ({
                _id: player._id,
                name: player.name,
                boardType: player.boardType,
                board: player.board,
                marked: player.marked,
                strikes: player.strikes,
                bingoWord: player.bingoWord,
            })),
            turn: room.turn,
            calledNumbers: room.calledNumbers,
            pendingProposal:
                room.pendingNumber && room.pendingBy
                    ? {
                          number: room.pendingNumber,
                          by: room.pendingBy,
                      }
                    : null,
            gameStatus: room.started ? 'playing' : 'waiting',
            createdAt: room?.createdAt,
            updatedAt: room?.updatedAt,
        }

        const responseData = {
            room: roomData,
            currentPlayer: currentPlayer
                ? {
                      _id: currentPlayer._id,
                      name: currentPlayer.name,
                      boardType: currentPlayer.boardType,
                      board: currentPlayer.board,
                      marked: currentPlayer.marked,
                      strikes: currentPlayer.strikes,
                      bingoWord: currentPlayer.bingoWord,
                  }
                : null,
            playerCount: room.players.length,
            canStart: room.players.length === 2 && !room.started,
        }

        return res.status(200).json({ success: true, message: 'Room state retrieved successfully', data: responseData })
    } catch (error) {
        console.error('Get Room State API Error:', error)
        return res.status(500).json({ success: false, message: 'Something went wrong' })
    }
}

export const getRoomInfo = async (req: Request, res: Response) => {
    try {
        const { roomId } = req.params

        const room = await Room.findOne({ roomId })
        if (!room) {
            return res.status(404).json({ success: false, message: 'Room not found' })
        }

        const roomInfo = {
            roomId: room.roomId,
            boardType: room.boardType,
            playerCount: room.players.length,
            started: room.started,
            canJoin: room.players.length < 2 && !room.started,
            players: room.players.map((p) => ({
                _id: p._id,
                name: p.name,
            })),
        }

        return res.status(200).json({ success: true, message: 'Room info retrieved successfully', data: roomInfo })
    } catch (error) {
        console.error('Get Room Info API Error:', error)
        return res.status(500).json({ success: false, message: 'Something went wrong' })
    }
}
