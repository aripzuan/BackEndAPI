import express from 'express';
import cors from 'cors';
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});


const path = await import('path');
const app = express();
app.use(cors())
app.use(express.json());

// Serve status.html at root
app.get('/', (req, res) => {
  res.sendFile(path.resolve(process.cwd(), 'status.html'));
});

// Get all courts
app.get('/api/courts', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM courts ORDER BY court_type, court_number');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a single court
app.get('/api/courts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM courts WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Court not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a court
app.post('/api/courts', async (req, res) => {
  try {
    const { court_type, court_number, status, price_per_hour } = req.body;
    const result = await pool.query(
      'INSERT INTO courts (court_type, court_number, status, price_per_hour) VALUES ($1, $2, $3, $4) RETURNING *',
      [court_type, court_number, status || 'available', price_per_hour]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a court
app.put('/api/courts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { court_type, court_number, status, price_per_hour } = req.body;
    const result = await pool.query(
      'UPDATE courts SET court_type = $1, court_number = $2, status = $3, price_per_hour = $4 WHERE id = $5 RETURNING *',
      [court_type, court_number, status, price_per_hour, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Court not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a court
app.delete('/api/courts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM courts WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all bookings (optionally filter by user)
app.get('/api/bookings', async (req, res) => {
  const { user_id } = req.query;
  try {
    let result;
    if (user_id) {
      result = await pool.query('SELECT * FROM bookings WHERE user_id = $1 ORDER BY date DESC, time_start', [user_id]);
    } else {
      result = await pool.query('SELECT * FROM bookings ORDER BY date DESC, time_start');
    }
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a booking
// Create a booking
app.post('/api/bookings', async (req, res) => {
  try {
    const { user_id, court_type, court_number, date, time_start, time_end, description } = req.body;
    // Check for double booking (time overlap)
    const conflict = await pool.query(
      `SELECT * FROM bookings
       WHERE court_type = $1
         AND court_number = $2
         AND date = $3
         AND (
           (time_start < $5 AND time_end > $4)
         )`,
      [court_type, court_number, date, time_start, time_end]
    );
    if (conflict.rows.length > 0) {
      return res.status(400).json({ error: 'Court already booked for this time.' });
    }
    const result = await pool.query(
      'INSERT INTO bookings (user_id, court_type, court_number, date, time_start, time_end, description) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [user_id, court_type, court_number, date, time_start, time_end, description]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a booking
app.put('/api/bookings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { date, time_start, time_end, description } = req.body;
    const result = await pool.query(
      'UPDATE bookings SET date = $1, time_start = $2, time_end = $3, description = $4 WHERE id = $5 RETURNING *',
      [date, time_start, time_end, description, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Booking not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a booking
app.delete('/api/bookings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM bookings WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Booking not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));