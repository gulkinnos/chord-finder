const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

// Create database connection
const dbPath = path.join(__dirname, 'songs.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create songs table
const createSongsTable = `
  CREATE TABLE IF NOT EXISTS songs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    share_id TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    chord_content TEXT NOT NULL,
    source_url TEXT,
    personal_notes TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`;

// Initialize database
function initDatabase() {
  try {
    db.exec(createSongsTable);
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

// Song operations
const songOperations = {
  // Create a new song
  create: (songData) => {
    const shareId = uuidv4().substring(0, 8);
    const stmt = db.prepare(`
      INSERT INTO songs (share_id, title, artist, chord_content, source_url, personal_notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      shareId,
      songData.title,
      songData.artist,
      songData.chord_content,
      songData.source_url || null,
      songData.personal_notes || ''
    );
    
    return { id: result.lastInsertRowid, share_id: shareId };
  },

  // Get all songs
  getAll: () => {
    const stmt = db.prepare('SELECT * FROM songs ORDER BY updated_at DESC');
    return stmt.all();
  },

  // Get song by ID
  getById: (id) => {
    const stmt = db.prepare('SELECT * FROM songs WHERE id = ?');
    return stmt.get(id);
  },

  // Get song by share ID
  getByShareId: (shareId) => {
    const stmt = db.prepare('SELECT * FROM songs WHERE share_id = ?');
    return stmt.get(shareId);
  },

  // Update song
  update: (id, songData) => {
    const stmt = db.prepare(`
      UPDATE songs 
      SET title = ?, artist = ?, chord_content = ?, source_url = ?, 
          personal_notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    const result = stmt.run(
      songData.title,
      songData.artist,
      songData.chord_content,
      songData.source_url || null,
      songData.personal_notes || '',
      id
    );
    
    return result.changes > 0;
  },

  // Delete song
  delete: (id) => {
    const stmt = db.prepare('DELETE FROM songs WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  },

  // Search songs
  search: (query) => {
    const stmt = db.prepare(`
      SELECT * FROM songs 
      WHERE title LIKE ? OR artist LIKE ? OR chord_content LIKE ?
      ORDER BY updated_at DESC
    `);
    const searchTerm = `%${query}%`;
    return stmt.all(searchTerm, searchTerm, searchTerm);
  }
};

// Initialize database on module load
initDatabase();

module.exports = {
  db,
  songOperations
};