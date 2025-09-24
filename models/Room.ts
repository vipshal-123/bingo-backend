import mongoose, { Schema, Document } from 'mongoose'

export type BoardType = '5x5' | '5x10'

export interface Strikes {
    rows: boolean[]
    columns: boolean[]
}

export interface BingoWord {
    B: boolean
    I: boolean
    N: boolean
    G: boolean
    O: boolean
}

export interface Player {
    _id: mongoose.Types.ObjectId
    name: string
    boardType: BoardType
    board: number[][]
    marked: boolean[][]
    strikes: Strikes
    bingoWord: BingoWord
}

export interface RoomDoc extends Document {
    roomId: string
    started: boolean
    boardType: BoardType
    players: Player[]
    turn: mongoose.Types.ObjectId | null
    pendingNumber: number | null
    pendingBy: mongoose.Types.ObjectId | null
    calledNumbers: number[]
    winner: mongoose.Types.ObjectId | null
    gameStatus: string
    createdAt: Date
    updatedAt: Date
}

const BingoWordSchema = new Schema<BingoWord>(
    {
        B: {
            type: Boolean,
            default: false,
        },
        I: {
            type: Boolean,
            default: false,
        },
        N: {
            type: Boolean,
            default: false,
        },
        G: {
            type: Boolean,
            default: false,
        },
        O: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true },
)

const PlayerSchema = new Schema<Player>(
    {
        name: {
            type: String,
            required: true,
        },
        boardType: {
            type: String,
            enum: ['5x5', '5x10'],
            required: true,
        },
        board: {
            type: [[Number]],
            default: [],
        },
        marked: {
            type: [[Boolean]],
            default: [],
        },
        strikes: {
            type: {
                rows: { type: [Boolean], default: [] },
                columns: { type: [Boolean], default: [] },
            },
            default: function (this: Player) {
                const size = this.boardType === '5x5' ? 5 : 10
                return {
                    rows: new Array(5).fill(false),
                    columns: new Array(size).fill(false),
                }
            },
        },
        bingoWord: {
            type: BingoWordSchema,
            default: () => ({
                B: false,
                I: false,
                N: false,
                G: false,
                O: false,
            }),
        },
    },
    { timestamps: true },
)

const RoomSchema = new Schema<RoomDoc>(
    {
        roomId: {
            type: String,
            required: true,
            unique: true,
        },
        started: {
            type: Boolean,
            default: false,
        },
        boardType: {
            type: String,
            enum: ['5x5', '5x10'],
            required: true,
        },
        players: {
            type: [PlayerSchema],
            default: [],
        },
        turn: {
            type: Schema.Types.ObjectId,
            default: null,
        },
        pendingNumber: {
            type: Number,
            default: null,
        },
        pendingBy: {
            type: Schema.Types.ObjectId,
            default: null,
        },
        calledNumbers: {
            type: [Number],
            default: [],
        },
        gameStatus: {
            type: String,
            enum: ['pending', 'ongoing', 'completed'],
            default: 'pending',
        },
        winner: {
            type: Schema.Types.ObjectId,
            default: null,
        },
    },
    { timestamps: true },
)

RoomSchema.pre('save', function (next) {
    this.players.forEach((player: any) => {
        if (!player.strikes || !player.strikes.rows?.length || !player.strikes.columns?.length) {
            const size = player.boardType === '5x5' ? 5 : 10
            player.strikes = {
                rows: new Array(5).fill(false),
                columns: new Array(size).fill(false),
            }
            player.bingoWord = {
                B: false,
                I: false,
                N: false,
                G: false,
                O: false,
            }
        }
    })
    next()
})

const Room = mongoose.model<RoomDoc>('room', RoomSchema, 'room')
export default Room
