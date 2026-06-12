import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { client } from '../config/redis.config.js'

const router = express.Router()

// ── REGISTER ────────────────────────────────────────
router.post('/register', async (req, res) => {
    try {
        const { email, password } = req.body

        // Check if user already exists in Redis
        const existingUser = await client.get(`user:${email}`)
        if (existingUser) {
            return res.status(409).json({
                message: 'User already exists'
            })
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12)

        // Save user to Redis
        const user = {
            email,
            password: hashedPassword,
            createdAt: new Date().toISOString()
        }
        await client.set(`user:${email}`, JSON.stringify(user))

        res.status(201).json({
            message: 'User registered successfully'
        })

    } catch (error) {
        console.error('Register error:', error)
        res.status(500).json({ message: 'Internal server error' })
    }
})

// ── LOGIN ────────────────────────────────────────────
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body

        // Find user in Redis
        const userData = await client.get(`user:${email}`)
        if (!userData) {
            return res.status(401).json({
                message: 'User not found'
            })
        }

        const user = JSON.parse(userData)

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password)
        if (!isPasswordValid) {
            return res.status(401).json({
                message: 'Invalid credentials'
            })
        }

        // Generate access token (15 min)
        const accessToken = jwt.sign(
            { email: user.email },
            process.env.JWT_ACCESS_SECRET,
            { expiresIn: process.env.JWT_ACCESS_EXPIRY }
        )

        // Generate refresh token (7 days)
        const refreshToken = jwt.sign(
            { email: user.email },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: process.env.JWT_REFRESH_EXPIRY }
        )

        // Store refresh token in Redis with TTL
        await client.setEx(
            `refresh:${user.email}`,
            7 * 24 * 60 * 60, // 7 days in seconds
            refreshToken
        )

        res.json({
            accessToken,
            refreshToken,
            user: { email: user.email }
        })

    } catch (error) {
        console.error('Login error:', error)
        res.status(500).json({ message: 'Internal server error' })
    }
})

// ── REFRESH TOKEN ─────────────────────────────────────
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body

        if (!refreshToken) {
            return res.status(401).json({ message: 'Refresh token required' })
        }

        // Verify refresh token
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET)

        // Check if refresh token exists in Redis
        const storedToken = await client.get(`refresh:${decoded.email}`)
        if (!storedToken || storedToken !== refreshToken) {
            return res.status(401).json({ message: 'Invalid refresh token' })
        }

        // Generate new access token
        const accessToken = jwt.sign(
            { email: decoded.email },
            process.env.JWT_ACCESS_SECRET,
            { expiresIn: process.env.JWT_ACCESS_EXPIRY }
        )

        res.json({ accessToken })

    } catch (error) {
        console.error('Refresh error:', error)
        res.status(401).json({ message: 'Invalid refresh token' })
    }
})

// ── LOGOUT ───────────────────────────────────────────
router.post('/logout', async (req, res) => {
    try {
        const { email } = req.body

        // Delete refresh token from Redis
        await client.del(`refresh:${email}`)

        res.json({ message: 'Logged out successfully' })

    } catch (error) {
        console.error('Logout error:', error)
        res.status(500).json({ message: 'Internal server error' })
    }
})

// ── VERIFY TOKEN ─────────────────────────────────────
router.get('/verify', async (req, res) => {
    try {
        const authHeader = req.headers.authorization
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'No token provided' })
        }

        const token = authHeader.split(' ')[1]
        const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET)

        res.json({
            valid: true,
            email: decoded.email
        })

    } catch (error) {
        res.status(401).json({ valid: false, message: 'Invalid token' })
    }
})

export default router