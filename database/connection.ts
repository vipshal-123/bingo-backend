import mongoose from 'mongoose'
import config from '@/config'

let connectionCounter = 0

export default function connectDatabase(callback: (isConnect: boolean) => void): void {
    if (!config.MONGO_URI) {
        console.error('❌ MONGO_URI is not defined in environment variables')
        callback(false)
        return
    }

    mongoose
        .connect(config.MONGO_URI)
        .then(() => {
            console.log('\x1b[34mDatabase Connection Successful')
            callback(true)
        })
        .catch((error: unknown) => {
            console.error(error)
            connectionCounter++
            if (connectionCounter === 10) {
                process.exit(-1)
            } else {
                setTimeout(() => {
                    connectDatabase(callback)
                }, 10000)
            }
        })
}
