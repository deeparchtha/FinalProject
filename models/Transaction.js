const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    type: { 
        type: String, 
        enum: ['income', 'expense'], 
        required: true 
    },
    amount: { 
        type: Number, 
        required: true,
        min: 0
    },
    category: { 
        type: String, 
        required: true,
        trim: true
    },
    description: { 
        type: String,
        trim: true
    },
    date: { 
        type: Date, 
        default: Date.now 
    },
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User',
        required: true,
        index: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Transaction', transactionSchema);