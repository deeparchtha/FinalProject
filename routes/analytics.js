const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const { getUserId } = require('../Middleware/auth');

// All routes require authentication
router.use(getUserId);

// 📊 GET EXPENSE DISTRIBUTION DATA
router.get('/expense-data', async (req, res) => {
    try {
        const currentMonth = new Date();
        currentMonth.setDate(1);
        currentMonth.setHours(0, 0, 0, 0);

        const expenseData = await Transaction.aggregate([
            {
                $match: {
                    type: 'expense',
                    date: { $gte: currentMonth },
                    userId: req.userId
                }
            },
            {
                $group: {
                    _id: '$category',
                    total: { $sum: '$amount' }
                }
            },
            {
                $sort: { total: -1 }
            }
        ]);

        const labels = expenseData.map(item => item._id);
        const values = expenseData.map(item => item.total);

        res.json({ labels, values });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 📈 GET MONTHLY INCOME/EXPENSE DATA
router.get('/monthly-data', async (req, res) => {
    try {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
        sixMonthsAgo.setDate(1);
        sixMonthsAgo.setHours(0, 0, 0, 0);

        const months = [];
        const incomeData = [];
        const expenseData = [];
        
        for (let i = 5; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            months.push(date.toLocaleString('default', { month: 'short' }));
            
            const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
            const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
            
            // Get income for this month
            const income = await Transaction.aggregate([
                {
                    $match: {
                        type: 'income',
                        date: { $gte: monthStart, $lte: monthEnd },
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
            
            // Get expenses for this month
            const expenses = await Transaction.aggregate([
                {
                    $match: {
                        type: 'expense',
                        date: { $gte: monthStart, $lte: monthEnd },
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
            
            incomeData.push(income.length > 0 ? income[0].total : 0);
            expenseData.push(expenses.length > 0 ? expenses[0].total : 0);
        }

        res.json({ 
            months, 
            income: incomeData, 
            expenses: expenseData 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 🎯 GET BUDGET VS ACTUAL DATA
router.get('/budget-comparison', async (req, res) => {
    try {
        const currentMonth = new Date();
        currentMonth.setDate(1);
        currentMonth.setHours(0, 0, 0, 0);

        const budgets = await Budget.find({ userId: req.userId });
        const comparisonData = {
            categories: [],
            budget: [],
            actual: []
        };

        for (const budget of budgets) {
            const spentData = await Transaction.aggregate([
                {
                    $match: {
                        type: 'expense',
                        category: budget.category,
                        date: { $gte: currentMonth },
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

            comparisonData.categories.push(budget.category);
            comparisonData.budget.push(budget.limit);
            comparisonData.actual.push(spentData.length > 0 ? spentData[0].total : 0);
        }

        res.json(comparisonData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 💡 GET BUDGET INSIGHTS
router.get('/insights', async (req, res) => {
    try {
        const currentMonth = new Date();
        currentMonth.setDate(1);
        currentMonth.setHours(0, 0, 0, 0);

        const budgets = await Budget.find({ userId: req.userId });
        const recommendations = [];
        let totalPotentialSavings = 0;

        for (const budget of budgets) {
            const spentData = await Transaction.aggregate([
                {
                    $match: {
                        type: 'expense',
                        category: budget.category,
                        date: { $gte: currentMonth },
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

            const spent = spentData.length > 0 ? spentData[0].total : 0;
            const percentage = (spent / budget.limit) * 100;

            if (spent > budget.limit) {
                const overspent = spent - budget.limit;
                totalPotentialSavings += overspent;
                
                recommendations.push({
                    category: budget.category,
                    message: `You overspent by ₹${overspent.toLocaleString('en-IN')}`,
                    suggestion: 'Reduce unnecessary expenses in this category',
                    priority: 'high',
                    icon: '⚠'
                });
            } else if (percentage > 80) {
                recommendations.push({
                    category: budget.category,
                    message: `You've used ${Math.round(percentage)}% of your budget`,
                    suggestion: 'Be careful with spending this month',
                    priority: 'medium',
                    icon: '💰'
                });
            } else if (percentage < 50) {
                recommendations.push({
                    category: budget.category,
                    message: 'Good job staying well under budget',
                    suggestion: 'Consider allocating funds to other categories',
                    priority: 'low',
                    icon: '✅'
                });
            }
        }

        const totalBudgets = budgets.length;
        const goodBudgets = recommendations.filter(rec => rec.priority === 'low').length;
        const improvementScore = totalBudgets > 0 ? Math.round((goodBudgets / totalBudgets) * 100) : 0;

        res.json({
            recommendations,
            totalSaved: Math.round(totalPotentialSavings),
            improvementScore
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 📋 GET MONTHLY REPORT
router.get('/monthly-report', async (req, res) => {
    try {
        const currentDate = new Date();
        const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

        // Get total income
        const incomeData = await Transaction.aggregate([
            {
                $match: {
                    type: 'income',
                    date: { $gte: monthStart, $lte: monthEnd },
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

        // Get total expenses
        const expenseData = await Transaction.aggregate([
            {
                $match: {
                    type: 'expense',
                    date: { $gte: monthStart, $lte: monthEnd },
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

        // Get top spending categories
        const topCategories = await Transaction.aggregate([
            {
                $match: {
                    type: 'expense',
                    date: { $gte: monthStart, $lte: monthEnd },
                    userId: req.userId
                }
            },
            {
                $group: {
                    _id: '$category',
                    total: { $sum: '$amount' }
                }
            },
            {
                $sort: { total: -1 }
            },
            {
                $limit: 5
            }
        ]);

        const totalIncome = incomeData.length > 0 ? incomeData[0].total : 0;
        const totalExpenses = expenseData.length > 0 ? expenseData[0].total : 0;
        const netSavings = totalIncome - totalExpenses;
        const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;

        const report = {
            month: currentDate.toLocaleString('default', { month: 'long' }),
            year: currentDate.getFullYear(),
            totalIncome,
            totalExpenses,
            netSavings,
            savingsRate: Math.round(savingsRate * 100) / 100,
            topCategories: topCategories.map(cat => ({
                name: cat._id,
                amount: cat.total,
                percentage: totalExpenses > 0 ? Math.round((cat.total / totalExpenses) * 100) : 0
            }))
        };

        res.json(report);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;