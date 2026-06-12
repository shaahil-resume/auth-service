import { createClient } from 'redis'
import dotenv from 'dotenv'

dotenv.config()
// Create Redis client

const client = createClient({
    socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
    },
    password: process.env.REDIS_PASSWORD
})

// Listen for errors
client.on('error', (err) => {
    console.error('Redis error:', err)
})

// Connect to Redis
const connectRedis = async () => {
    await client.connect()
}

export { client, connectRedis }