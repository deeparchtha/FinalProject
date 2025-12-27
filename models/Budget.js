const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User',
        required: true,
        index: true
    },
    category: { 
        type: String, 
        required: true,
        trim: true
    },
    limit: { 
        type: Number, 
        required: true,
        min: 0
    },
    period: { 
        type: String, 
        enum: ['weekly', 'monthly'], 
        default: 'monthly' 
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
}, {
    timestamps: true
});

// Ensure unique category per user
budgetSchema.index({ userId: 1, category: 1 }, { unique: true });

module.exports = mongoose.model('Budget', budgetSchema);