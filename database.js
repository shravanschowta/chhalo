const sqlite3 = require('sqlite3').verbose();

// Connect to a file-based database (creates 'commute.db' automatically)
const db = new sqlite3.Database('./commute.db', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
    }
});

// Create a table to store search history
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS search_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_loc TEXT,
        to_loc TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

module.exports = db;