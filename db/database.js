const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, 'chords.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS songs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      share_id TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      artist TEXT NOT NULL DEFAULT 'Unknown Artist',
      source_url TEXT,
      chord_content TEXT,
      notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_songs_share_id ON songs(share_id);
    CREATE INDEX IF NOT EXISTS idx_songs_title ON songs(title);
  `);
}

function createSong({ title, artist, sourceUrl, chordContent, notes }) {
  const shareId = uuidv4().slice(0, 8);
  const stmt = getDb().prepare(`
    INSERT INTO songs (share_id, title, artist, source_url, chord_content, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(shareId, title, artist || 'Unknown Artist', sourceUrl || '', chordContent || '', notes || '');
  return getSongById(result.lastInsertRowid);
}

function getSongById(id) {
  return getDb().prepare('SELECT * FROM songs WHERE id = ?').get(id);
}

function getSongByShareId(shareId) {
  return getDb().prepare('SELECT * FROM songs WHERE share_id = ?').get(shareId);
}

function getAllSongs() {
  return getDb().prepare('SELECT * FROM songs ORDER BY updated_at DESC').all();
}

function updateSong(id, { title, artist, chordContent, notes }) {
  const fields = [];
  const values = [];

  if (title !== undefined) { fields.push('title = ?'); values.push(title); }
  if (artist !== undefined) { fields.push('artist = ?'); values.push(artist); }
  if (chordContent !== undefined) { fields.push('chord_content = ?'); values.push(chordContent); }
  if (notes !== undefined) { fields.push('notes = ?'); values.push(notes); }

  if (fields.length === 0) return getSongById(id);

  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  getDb().prepare(`UPDATE songs SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getSongById(id);
}

function deleteSong(id) {
  return getDb().prepare('DELETE FROM songs WHERE id = ?').run(id);
}

function searchSongs(query) {
  return getDb().prepare(
    'SELECT * FROM songs WHERE title LIKE ? OR artist LIKE ? ORDER BY updated_at DESC'
  ).all(`%${query}%`, `%${query}%`);
}

function close() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = {
  getDb,
  createSong,
  getSongById,
  getSongByShareId,
  getAllSongs,
  updateSong,
  deleteSong,
  searchSongs,
  close,
};
