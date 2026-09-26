require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const ALLOWED_CATEGORIES = ['Food', 'Transport', 'Bills', 'Entertainmetn', 'Others'];

function validateExpenseData(body){
    if (!body || typeof body !== 'object') {
        return 'Request body is required and must be valid JSON.';
    }
    const {title, amount, category, date} = body;

    if(!title || typeof title !== 'string' || title.trim() === ''){
        return 'Title is required and must be text.';
    }

    const numAmount = parseFloat(amount);
    if(isNaN(numAmount) || numAmount <= 0){
        return 'Amount must be a number greater than 0.';
    }

    if(!category || !ALLOWED_CATEGORIES.includes(category)){
        return `Category must be one of: ${ALLOWED_CATEGORIES.join(', ')}.`;
    }

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return 'Date is required in YYYY-MM-DD format.';
    }

    return null;

}

app.get('/api/expenses', async (req, res) => {
    try{
        const query = `
            SELECT id, title, amount::float AS amount, category, TO_CHAR(date, 'YYYY-MM-DD') AS date
            FROM expenses
            ORDER BY id ASC;
        `;
        const result = await pool.query(query);
        res.status(200).json(result.rows);
    }catch(err){
        console.error(err);
        res.status(500).json({message: 'Server error retrieving expenses.'});
    }
    
});

app.get('/api/expenses/:id', async (req, res) => {
    const {id} = req.params;

    if(!/^\d+$/.test(id)){
        return res.status(404).json({message: 'Expense not found (invalid ID).'});
    }

    try{
        const query = `
            SELECT id, title, amount::float AS amount, category, TO_CHAR(date, 'YYYY-MM-DD') AS date
            FROM expenses
            WHERE id = $1;
        `;
        const result = await pool.query(query, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Expense not found.' });
    }
        res.status(200).json(result.rows);
    }catch(err){
        console.error(err);
        res.status(500).json({message: 'Server error retrieving expenses.'});
    }
    
});

app.post('/api/expenses', async (req, res) => {
    const errorMsg= validateExpenseData(req.body);
    
    if (errorMsg){
        return res.status(400).json({message: errorMsg});
    }

    const {title, amount, category, date} = req.body;

    try{
        const query = `
            INSERT INTO expenses (title, amount, category, date)
            VALUES ($1, $2, $3, $4)
            RETURNING
                id, title, amount::float AS amount, category, TO_CHAR(date, 'YYYY-MM-DD') AS date;
            
        `;
        const values = [title.trim(), parseFloat(amount), category, date];
        const result = await pool.query(query, values);
        res.status(201).json(result.rows[0]);
    }catch(err){
        console.error(err);
        res.status(500).json({message: 'Server error adding expenses.'});
    }
    
});

app.put('/api/expenses/:id', async(req, res) =>{
    const {id}= req.params;

    if(!/^\d+$/.test(id)){
        return res.status(404).json({message: 'Expense not found (invalid ID).'});
    }

    const errorMsg = validateExpenseData(req.body);
    if(errorMsg){
        return res.status(400).json({message: errorMsg});
    }

    const {title, amount, category, date} = req.body;

    try{
        const query = `
            UPDATE expenses
            SET title = $1, amount = $2, category = $3, date = $4
            WHERE id = $5
            RETURNING
                id, title, amount::float AS amount, category, TO_CHAR(date, 'YYYY-MM-DD') AS date;
        `;
        
        const values = [title.trim(), parseFloat(amount), category, date, id];
        const result = await pool.query(query, values);

        if (result.rows.length === 0){
            return res.status(404).json({message: 'Expense not found.'});
        }
        res.status(200).json(result.rows[0]);
    } catch(err){
        console.error(err);
        res.status(500).json({message: 'Server error updating expense.'})
    }
});

app.delete('/api/expenses/:id', async(req, res) => {
    const {id} = req.params;

    if(!/^\d+$/.test(id)){
        return res.status(404).json({message: 'Expense not found (invalid ID).'});
    }

    try{
        const query =`
            DELETE FROM expenses
            WHERE id = $1 
            RETURNING id;
        `;
        const result = await pool.query(query, [id]);

        if(result.rows.length === 0){
            return res.status(404).json({message: 'Expense not found.'});
        }

        res.status(200).json({message: 'Expense deleted successfully.'});
    } catch(err){
        console.error(err);
        res.status(500).json({message: 'Server error deleting expense.'});
    }

});

app.listen(PORT, ()=>{
    console.log('Server listening on http://localhost:${PORT}')
})
