// socket/SocketInstance.ts
import config from '@/config'
import { instrument } from '@socket.io/admin-ui'
import { Server, Socket } from 'socket.io'
import { bingoSocketHandler } from './bingoSocketHandler'

export class SocketInstance {
    private static io: Server

    constructor(httpServer: any) {
        SocketInstance.io = new Server(httpServer, {
            cors: {
                origin: config.CORS_ORIGIN,
                credentials: true,
            },
        })

        this.registerHandlers()
        instrument(SocketInstance.io, {
            auth: false,
            mode: 'development',
            // namespaceName: '/admin',
        })
    }

    private registerHandlers(): void {
        SocketInstance.io.on('connection', (socket: Socket) => {
            console.log(`Socket connected: ${socket.id}`)

            // Register game-specific handlers
            bingoSocketHandler(SocketInstance.io, socket)

            // socket.on('disconnecting', () => {
            //     const rooms = Array.from(socket.rooms).filter((r) => r !== socket.id)
            //     console.log('rooms======: ', rooms);
            //     console.log(`Socket disconnected: ${socket.id}`)
            // })
        })
    }

    static emitToRoom(roomId: string | number, event: string, payload: unknown): void {
        console.log('roomId: ', roomId);
        SocketInstance.io.to(roomId.toString()).emit(event, payload)
    }

    static emitToAll(event: string, payload: unknown): void {
        SocketInstance.io.emit(event, payload)
    }

    static emitToIds(ids: string[], event: string, payload: unknown): void {
        SocketInstance.io.in(ids).emit(event, payload)
    }
}

// Utility exports
export const socketEmitToRoom = (roomId: string | number, event: string, data: unknown): void => {
    SocketInstance.emitToRoom(roomId, event, data)
}

export const socketEmitToAll = (event: string, data: unknown): void => {
    SocketInstance.emitToAll(event, data)
}

export const socketEmitToIds = (ids: string[], event: string, data: unknown): void => {
    SocketInstance.emitToIds(ids, event, data)
}
