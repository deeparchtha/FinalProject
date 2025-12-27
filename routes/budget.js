const express = require('express');
const router = express.Router();
const Budget = require('../models/Budget');
const Transaction = require('../models/Transaction');
const { getUserId } = require('../Middleware/auth');

// All routes require authentication
router.use(getUserId);

// ✅ SET/UPDATE BUDGET
router.post('/', async (req, res) => {
    try {
        const { category, limit } = req.body;

        if (!category || !limit) {
            return res.status(400).json({ 
                message: 'Category and limit are required' 
            });
        }

        if (limit <= 0) {
            return res.status(400).json({ 
                message: 'Budget limit must be greater than 0' 
            });
        }

        const categoryTrimmed = category.trim();
        const categoryLower = categoryTrimmed.toLowerCase();
        
        // Check if budget already exists for this category
        const existingBudget = await Budget.findOne({ 
            userId: req.userId,
            $expr: {
                $eq: [
                    { $toLower: "$category" },
                    categoryLower
                ]
            }
        });

        if (existingBudget) {
            // Update existing budget
            existingBudget.limit = parseFloat(limit);
            const updatedBudget = await existingBudget.save();
            
            return res.json({
                message: 'Budget updated successfully',
                budget: updatedBudget
            });
        } else {
            // Create new budget
            const budget = new Budget({
                userId: req.userId,
                category: categoryTrimmed,
                limit: parseFloat(limit),
                period: 'monthly'
            });
            
            const savedBudget = await budget.save();
            res.status(201).json({
                message: 'Budget created successfully',
                budget: savedBudget
            });
        }
    } catch (error) {
        console.error('Error setting budget:', error);
        if (error.code === 11000) {
            return res.status(400).json({ 
                message: 'Budget for this category already exists' 
            });
        }
        res.status(500).json({ 
            message: 'Error setting budget',
            error: error.message 
        });
    }
});

// ✅ GET BUDGET ALERTS
router.get('/alerts', async (req, res) => {
    try {
        const budgets = await Budget.find({ userId: req.userId });
        const alerts = [];
        
        const currentMonthStart = new Date();
        currentMonthStart.setDate(1);
        currentMonthStart.setHours(0, 0, 0, 0);

        for (let budget of budgets) {
            const spentData = await Transaction.aggregate([
                { 
                    $match: { 
                        type: 'expense', 
                        category: budget.category,
                        date: { $gte: currentMonthStart },
                        userId: req.userId
                    } 
                },
                { 
                    $group: { 
                        _id: null, 
                        total: { $sum: '$amount' } 
                    } 
                }
            ]);
            
            const totalSpent = spentData.length > 0 ? spentData[0].total : 0;
            const percentage = (totalSpent / budget.limit) * 100;
            
            if (percentage > 80) {
                let alertMessage;
                
                if (totalSpent > budget.limit) {
                    alertMessage = '🚨 OVER BUDGET!';
                } else if (percentage > 90) {
                    alertMessage = '⚠ Almost reached budget limit!';
                } else {
                    alertMessage = '⚠ Approaching budget limit';
                }
                
                alerts.push({
                    category: budget.category,
                    spent: totalSpent,
                    limit: budget.limit,
                    percentage: Math.round(percentage),
                    alert: alertMessage
                });
            }
        }
        
        res.json(alerts);
    } catch (error) {
        console.error('Error checking budget alerts:', error);
        res.status(500).json({ 
            message: 'Error checking budget alerts',
            error: error.message 
        });
    }
});

// ✅ GET ALL BUDGETS
router.get('/', async (req, res) => {
    try {
        const budgets = await Budget.find({ userId: req.userId })
            .sort({ category: 1 });
        res.json(budgets);
    } catch (error) {
        console.error('Error fetching budgets:', error);
        res.status(500).json({ 
            message: 'Error fetching budgets',
            error: error.message 
        });
    }
});

// ✅ DELETE BUDGET
router.delete('/:id', async (req, res) => {
    try {
        const budget = await Budget.findOneAndDelete({ 
            _id: req.params.id, 
            userId: req.userId 
        });
        
        if (!budget) {
            return res.status(404).json({ message: 'Budget not found' });
        }
        
        res.json({ message: 'Budget deleted successfully' });
    } catch (error) {
        console.error('Error deleting budget:', error);
        res.status(500).json({ 
            message: 'Error deleting budget',
            error: error.message 
        });
    }
});

// ✅ GET BUDGET SUMMARY
router.get('/summary', async (req, res) => {
    try {
        const budgets = await Budget.find({ userId: req.userId });
        const summary = [];

        const currentMonthStart = new Date();
        currentMonthStart.setDate(1);
        currentMonthStart.setHours(0, 0, 0, 0);

        for (let budget of budgets) {
            const spentData = await Transaction.aggregate([
                { 
                    $match: { 
                        type: 'expense', 
                        category: budget.category,
                        date: { $gte: currentMonthStart },
                        userId: req.userId
                    } 
                },
                { 
                    $group: { 
                        _id: null, 
                        total: { $sum: '$amount' } 
                    } 
                }
            ]);
            
            const totalSpent = spentData.length > 0 ? spentData[0].total : 0;
            const remaining = budget.limit - totalSpent;
            const percentage = (totalSpent / budget.limit) * 100;

            summary.push({
                category: budget.category,
                limit: budget.limit,
                spent: totalSpent,
                remaining: remaining > 0 ? remaining : 0,
                percentage: Math.round(percentage),
                status: remaining > 0 ? 'under_budget' : 'over_budget'
            });
        }
        
        res.json(summary);
    } catch (error) {
        console.error('Error fetching budget summary:', error);
        res.status(500).json({ 
            message: 'Error fetching budget summary',
            error: error.message 
        });
    }
});

module.exports = router;