import { Server, Socket } from 'socket.io'
import { Room } from '@/models'
import { socketEmitToRoom } from './socket'

const socketRoomMap = new Map<string, string>()

export function bingoSocketHandler(io: Server, socket: Socket) {
    socket.on('createRoom', async (payload, cb) => {
        try {
            const { roomId } = payload

            socket.join(roomId)
            cb({ ok: true, roomId })
        } catch (err) {
            console.error(err)
            cb({ ok: false, error: String(err) })
        }
    })

    socket.on('joinRoom', async (payload, cb) => {
        try {
            const { roomId } = payload

            const room = await Room.findOne({ roomId })

            socket.join(roomId)
            socketRoomMap.set(socket.id, roomId)
            socketEmitToRoom(roomId, 'playerJoined', { roomId: roomId, players: room?.players })

            cb({ ok: true, roomId })
        } catch (err) {
            console.error(err)
            cb({ ok: false, error: String(err) })
        }
    })

    socket.on('startGame', async ({ roomId }, cb) => {
        try {
            const room = await Room.findOne({ roomId })
            if (!room) return cb({ ok: false, error: 'Room not found' })
            if (room.players.length < 2) return cb({ ok: false, error: 'Need 2 players' })

            room.started = true
            await room.save()

            io.to(roomId).emit('gameStarted', {
                calledNumbers: room.calledNumbers || [],
                turn: room.turn,
                players: room.players.map((p) => ({ id: p._id, name: p.name, strikes: p.strikes })),
            })

            cb({ ok: true })
        } catch (err) {
            console.error(err)
            cb({ ok: false, error: String(err) })
        }
    })

    socket.on('proposeNumber', async ({ roomId, playerId, number }, cb) => {
        try {
            const room = await Room.findOne({ roomId })
            if (!room) return cb({ ok: false, error: 'Room not found' })
            if (String(room.turn) !== String(playerId)) return cb({ ok: false, error: 'Not your turn' })
            if (room.pendingNumber !== null) return cb({ ok: false, error: 'Pending number exists' })

            room.pendingNumber = number
            room.pendingBy = playerId
            await room.save()

            io.to(roomId).emit('opponentProposed', { number, by: playerId })
            cb({ ok: true })
        } catch (err) {
            console.error(err)
            cb({ ok: false, error: String(err) })
        }
    })

    socket.on('confirmProposal', async ({ roomId, playerId }, cb) => {
        try {
            const room = await Room.findOne({ roomId })
            if (!room) return cb({ ok: false, error: 'Room not found' })
            const pending = room.pendingNumber
            if (pending === null) return cb({ ok: false, error: 'No pending number' })

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

            io.to(roomId).emit('proposalConfirmed', {
                number: pending,
                by: playerId,
                calledNumbers: room.calledNumbers,
                turn: room.turn,
                players: room.players.map((p) => ({ id: p._id, marked: p.marked })),
            })

            cb({ ok: true })
        } catch (err) {
            console.error(err)
            cb({ ok: false, error: String(err) })
        }
    })

    socket.on('callBingo', async ({ roomId, playerId }, cb) => {
        try {
            const room = await Room.findOne({ roomId })
            if (!room) return cb({ ok: false, error: 'Room not found' })

            const player = room.players.find((p) => String(p._id) === String(playerId))
            if (!player) return cb({ ok: false, error: 'Not in room' })

            const rows: boolean[][] = player.marked

            const rowWin = rows.some((r) => r.every(Boolean))
            const colWin = rows[0].map((_, c) => rows.every((r) => r[c])).some(Boolean)
            const diag1 = rows.map((r, i) => r[i]).every(Boolean)
            const diag2 = rows.map((r, i) => r[r.length - 1 - i]).every(Boolean)

            if (rowWin || colWin || diag1 || diag2) {
                io.to(roomId).emit('gameOver', { winner: playerId })
                cb({ ok: true, winner: true })
            } else {
                cb({ ok: false, error: 'Not a valid bingo' })
            }
        } catch (err) {
            console.error(err)
            cb({ ok: false, error: String(err) })
        }
    })

    socket.on('rejoinRoom', async ({ roomId, playerId }, cb) => {
        const room = await Room.findOne({ roomId })
        if (!room) return cb({ ok: false, error: 'Room not found' })

        const player = room.players.find((p) => String(p._id) === String(playerId))
        if (!player) return cb({ ok: false, error: 'Player not found' })

        socket.join(roomId)
        await room.save()

        cb({
            ok: true,
            roomId: room.roomId,
            board: player.board,
            boardType: player.boardType,
            playerId: player._id,
        })

        socket.to(roomId).emit('playerRejoined', { playerId: player._id, name: player.name })
    })

    socket.on('leave-room', (roomId) => {
        console.log('roomId==leave: ', roomId)
        socket.leave(roomId)
        socketRoomMap.delete(socket.id)
        io.to(roomId).emit('playerLeft', { leftId: socket.id })
    })

    socket.on('disconnecting', () => {
        const roomId = socketRoomMap.get(socket.id)
        if (roomId) {
            io.to(roomId).emit('playerLeft', { playerId: socket.id })
            socketRoomMap.delete(socket.id)
        }
    })
}
