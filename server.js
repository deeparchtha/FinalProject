const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const User = require('./models/User');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Session configuration - SIMPLIFIED
app.use(session({
    secret: process.env.SESSION_SECRET || 'expense-tracker-secret-key-2025',
    resave: true,
    saveUninitialized: true,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        ttl: 24 * 60 * 60
    }),
    cookie: {
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: false
    }
}));

// Initialize Passport but don't use it for auth (we're using custom auth)
app.use(passport.initialize());
app.use(passport.session());

// Configure Passport (but won't use it directly)
passport.use(new LocalStrategy(
    async (username, password, done) => {
        try {
            const user = await User.findOne({ 
                $or: [{ username }, { email: username }] 
            });
            
            if (!user) {
                return done(null, false, { message: 'Invalid username or email' });
            }
            
            const isValidPassword = await user.comparePassword(password);
            if (!isValidPassword) {
                return done(null, false, { message: 'Incorrect password' });
            }
            
            return done(null, user);
        } catch (error) {
            return done(error);
        }
    }
));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (error) {
        done(error);
    }
});

// Import routes
const transactionRoutes = require('./routes/transactions');
const budgetRoutes = require('./routes/budget');  
const analyticsRoutes = require('./routes/analytics');
const authRoutes = require('./routes/auth');

// Use routes
app.use('/api/transactions', transactionRoutes);
app.use('/api/budget', budgetRoutes);  
app.use('/api/analytics', analyticsRoutes);
app.use('/api/auth', authRoutes);

// Serve HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI )
    .then(() => console.log('✅ Connected to MongoDB!'))
    .catch(err => console.log('❌ MongoDB connection error:', err.message));

app.listen(PORT, () => {
    console.log(`🎯 Server running on http://localhost:${PORT}`);
    console.log(`🔐 Authentication enabled`);
});
