const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Register route
router.post('/register', async (req, res) => {
    try {
        console.log('Registration attempt:', req.body);
        const { username, email, password } = req.body;
        
        // Validation
        if (!username || !email || !password) {
            return res.status(400).json({ 
                success: false,
                message: 'Username, email and password are required' 
            });
        }
        
        if (password.length < 6) {
            return res.status(400).json({ 
                success: false,
                message: 'Password must be at least 6 characters' 
            });
        }
        
        // Check if user exists
        const existingUser = await User.findOne({ 
            $or: [{ username }, { email }] 
        });
        
        if (existingUser) {
            return res.status(400).json({ 
                success: false,
                message: 'Username or email already exists' 
            });
        }
        
        // Create new user
        const user = new User({ username, email, password });
        await user.save();
        
        // Manually login after registration
        req.login(user, (err) => {
            if (err) {
                console.error('Auto login error:', err);
                return res.json({ 
                    success: true,
                    message: 'Registration successful! Please login',
                    user: { 
                        id: user._id, 
                        username: user.username, 
                        email: user.email 
                    }
                });
            }
            
            // Set session
            req.session.userId = user._id;
            req.session.save();
            
            res.json({ 
                success: true,
                message: 'Registration successful',
                user: { 
                    id: user._id, 
                    username: user.username, 
                    email: user.email 
                }
            });
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Registration failed', 
            error: error.message 
        });
    }
});

// Login route
router.post('/login', (req, res) => {
    console.log('Login attempt:', req.body);
    
    // Custom authentication
    const authenticateUser = async (username, password) => {
        try {
            const user = await User.findOne({ 
                $or: [{ username }, { email: username }] 
            });
            
            if (!user) {
                return { success: false, message: 'Invalid username or email' };
            }
            
            const isValidPassword = await user.comparePassword(password);
            if (!isValidPassword) {
                return { success: false, message: 'Incorrect password' };
            }
            
            return { success: true, user };
        } catch (error) {
            console.error('Auth error:', error);
            return { success: false, message: 'Authentication error' };
        }
    };

    // Handle authentication
    authenticateUser(req.body.username, req.body.password)
        .then(authResult => {
            if (!authResult.success) {
                return res.status(401).json({ 
                    success: false,
                    message: authResult.message 
                });
            }
            
            // Manual login without passport
            req.login(authResult.user, (err) => {
                if (err) {
                    return res.status(500).json({ 
                        success: false,
                        message: 'Login failed' 
                    });
                }
                
                // Set session
                req.session.userId = authResult.user._id;
                req.session.save();
                
                res.json({ 
                    success: true,
                    message: 'Login successful',
                    user: { 
                        id: authResult.user._id, 
                        username: authResult.user.username, 
                        email: authResult.user.email 
                    }
                });
            });
        })
        .catch(error => {
            res.status(500).json({ 
                success: false,
                message: 'Login error' 
            });
        });
});

// Logout route
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ 
                success: false,
                message: 'Logout failed' 
            });
        }
        res.json({ 
            success: true,
            message: 'Logout successful' 
        });
    });
});

// Get current user
router.get('/current', (req, res) => {
    console.log('Checking current user session:', req.session.userId);
    
    if (req.session.userId) {
        User.findById(req.session.userId)
            .then(user => {
                if (user) {
                    res.json({ 
                        success: true,
                        user: { 
                            id: user._id, 
                            username: user.username, 
                            email: user.email 
                        } 
                    });
                } else {
                    res.status(401).json({ 
                        success: false,
                        message: 'User not found' 
                    });
                }
            })
            .catch(error => {
                res.status(500).json({ 
                    success: false,
                    message: 'Error fetching user' 
                });
            });
    } else {
        res.status(401).json({ 
            success: false,
            message: 'Not authenticated' 
        });
    }
});

module.exports = router;
