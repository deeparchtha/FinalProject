const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const { getUserId } = require('../Middleware/auth');

// All routes require authentication
router.use(getUserId);

// ✅ ADD TRANSACTION
router.post('/', async (req, res) => {
    try {
        const { type, amount, category, description } = req.body;

        // Validation
        if (!type || !amount || !category) {
            return res.status(400).json({ 
                message: 'Type, amount, and category are required' 
            });
        }

        if (amount <= 0) {
            return res.status(400).json({ 
                message: 'Amount must be greater than 0' 
            });
        }

        // Create transaction
        const transaction = new Transaction({
            userId: req.userId,
            type: type,
            amount: parseFloat(amount),
            category: category.trim(),
            description: description || '',
            date: new Date()
        });
        
        const savedTransaction = await transaction.save();
        
        res.status(201).json({
            message: 'Transaction added successfully',
            transaction: savedTransaction
        });
    } catch (error) {
        console.error('Error adding transaction:', error);
        res.status(500).json({ 
            message: 'Error adding transaction',
            error: error.message 
        });
    }
});

// ✅ GET ALL TRANSACTIONS
router.get('/', async (req, res) => {
    try {
        const transactions = await Transaction.find({ userId: req.userId })
            .sort({ date: -1 });
        res.json(transactions);
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ 
            message: 'Error fetching transactions',
            error: error.message 
        });
    }
});

// ✅ DELETE TRANSACTION
router.delete('/:id', async (req, res) => {
    try {
        const transaction = await Transaction.findOneAndDelete({ 
            _id: req.params.id, 
            userId: req.userId 
        });
        
        if (!transaction) {
            return res.status(404).json({ message: 'Transaction not found' });
        }
        
        res.json({ message: 'Transaction deleted successfully' });
    } catch (error) {
        console.error('Error deleting transaction:', error);
        res.status(500).json({ 
            message: 'Error deleting transaction',
            error: error.message 
        });
    }
});

module.exports = router;