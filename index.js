import express from 'express'
import dotenv from 'dotenv'
import authRoutes from './src/routes/auth.routes.js'
import { connectRedis } from './src/config/redis.config.js'

dotenv.config()

// Create Express app
const app = express()
const PORT = process.env.PORT || 3001

// Middleware — parse incoming JSON requests
app.use(express.json())

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'UP',
        service: 'auth-service',
        timestamp: new Date().toISOString()
    })
})

// Routes
app.use('/api/auth', authRoutes)

// Start server
const startServer = async () => {
    try {
        // Connect to Redis first
        await connectRedis()
        console.log('Redis connected')

        // Then start Express
        app.listen(PORT, () => {
            console.log(`Auth service running on port ${PORT}`)
        })
    } catch (error) {
        console.error('Failed to start server:', error)
        process.exit(1)
    }
}

startServer()