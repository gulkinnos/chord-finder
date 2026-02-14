const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db/database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- API Routes ---

// Search for chords online (proxy to avoid CORS issues)
app.get('/api/search', async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: 'Query parameter "q" is required' });

  try {
    const isCyrillic = /[а-яА-ЯЁё]/.test(query);
    const results = [];

    if (isCyrillic) {
      const searchUrl = `https://amdm.ru/search/?q=${encodeURIComponent(query)}`;
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(searchUrl)}`;
      const response = await fetch(proxyUrl);

      if (response.ok) {
        const html = await response.text();
        // Extract song links from amdm.ru search results
        const itemRegex = /<a[^>]*href="(\/akkordy[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
        let match;
        const seen = new Set();

        while ((match = itemRegex.exec(html)) !== null && results.length < 10) {
          const href = match[1];
          const text = match[2].replace(/<[^>]+>/g, '').trim();
          if (text && !seen.has(href) && href.includes('/akkordy/')) {
            seen.add(href);
            const parts = text.split(/\s*[-–—]\s*/);
            results.push({
              title: parts.length > 1 ? parts.slice(1).join(' - ') : text,
              artist: parts.length > 1 ? parts[0] : 'Unknown Artist',
              sourceUrl: `https://amdm.ru${href}`,
              isManual: false,
            });
          }
        }
      }

      if (results.length === 0) {
        results.push({
          title: query,
          artist: 'Search on Amdm.ru',
          sourceUrl: `https://amdm.ru/search/?q=${encodeURIComponent(query)}`,
          isManual: true,
        });
      }
    } else {
      // Try to scrape Ultimate Guitar search results
      try {
        const ugSearchUrl = `https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(query)}`;
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(ugSearchUrl)}`;
        const response = await fetch(proxyUrl);

        if (response.ok) {
          const html = await response.text();
          // UG embeds search results as JSON in a data-content attribute
          const storeMatch = html.match(/class="js-store"\s+data-content="([^"]+)"/);
          if (storeMatch) {
            const jsonStr = storeMatch[1]
              .replace(/&quot;/g, '"')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&#039;/g, "'");
            const storeData = JSON.parse(jsonStr);
            const searchData = storeData?.store?.page?.data?.results || [];

            // Filter for chord-type results and sort by rating
            const chordResults = searchData
              .filter(item => item && item.tab_url && item.type === 'Chords')
              .sort((a, b) => (b.rating || 0) - (a.rating || 0));

            for (const item of chordResults) {
              if (results.length >= 10) break;
              results.push({
                title: item.song_name || query,
                artist: item.artist_name || 'Unknown Artist',
                sourceUrl: item.tab_url,
                isManual: false,
              });
            }
          }
        }
      } catch (err) {
        console.error('English search scrape error:', err.message);
      }

      // Fallback to manual links if scraping didn't yield results
      if (results.length === 0) {
        results.push({
          title: query,
          artist: 'Search on Ultimate-Guitar',
          sourceUrl: `https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(query)}`,
          isManual: true,
        });
        results.push({
          title: query,
          artist: 'Search on Chordify',
          sourceUrl: `https://chordify.net/search/${encodeURIComponent(query)}`,
          isManual: true,
        });
      }
    }

    res.json(results);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Fetch chord content from a URL (proxy)
app.get('/api/chords', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: 'URL parameter is required' });

  try {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl);
    const html = await response.text();

    // Extract chord content - look for common chord containers
    let chordContent = '';

    // Try amdm.ru format
    const preMatch = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
    if (preMatch) {
      chordContent = preMatch[1]
        .replace(/<[^>]+>/g, '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"');
    }

    if (!chordContent) {
      const chordTextMatch = html.match(/class="[^"]*chord[_-]?text[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
      if (chordTextMatch) {
        chordContent = chordTextMatch[1].replace(/<[^>]+>/g, '').trim();
      }
    }

    if (!chordContent) {
      const songTextMatch = html.match(/class="[^"]*song[_-]?text[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
      if (songTextMatch) {
        chordContent = songTextMatch[1].replace(/<[^>]+>/g, '').trim();
      }
    }

    // Try Ultimate Guitar format (JSON embedded in data-content attribute)
    if (!chordContent) {
      const storeMatch = html.match(/class="js-store"\s+data-content="([^"]+)"/);
      if (storeMatch) {
        try {
          const jsonStr = storeMatch[1]
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&#039;/g, "'");
          const storeData = JSON.parse(jsonStr);
          const content = storeData?.store?.page?.data?.tab_view?.wiki_tab?.content;
          if (content) {
            chordContent = content
              .replace(/\[ch\](.*?)\[\/ch\]/g, '$1')
              .replace(/\[tab\]/g, '')
              .replace(/\[\/tab\]/g, '')
              .replace(/\r\n/g, '\n')
              .trim();
          }
        } catch (e) {
          // JSON parse failed, continue
        }
      }
    }

    res.json({ chordContent: chordContent || null });
  } catch (error) {
    console.error('Chord fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch chords' });
  }
});

// Get all saved songs
app.get('/api/songs', (req, res) => {
  const { q } = req.query;
  const songs = q ? db.searchSongs(q) : db.getAllSongs();
  res.json(songs);
});

// Get a single song by ID
app.get('/api/songs/:id', (req, res) => {
  const song = db.getSongById(req.params.id);
  if (!song) return res.status(404).json({ error: 'Song not found' });
  res.json(song);
});

// Save a new song
app.post('/api/songs', (req, res) => {
  const { title, artist, sourceUrl, chordContent, notes } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });

  const song = db.createSong({ title, artist, sourceUrl, chordContent, notes });
  res.status(201).json(song);
});

// Update a song
app.put('/api/songs/:id', (req, res) => {
  const existing = db.getSongById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Song not found' });

  const { title, artist, chordContent, notes } = req.body;
  const updated = db.updateSong(req.params.id, { title, artist, chordContent, notes });
  res.json(updated);
});

// Delete a song
app.delete('/api/songs/:id', (req, res) => {
  const existing = db.getSongById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Song not found' });

  db.deleteSong(req.params.id);
  res.json({ success: true });
});

// Get shared song by share ID
app.get('/api/share/:shareId', (req, res) => {
  const song = db.getSongByShareId(req.params.shareId);
  if (!song) return res.status(404).json({ error: 'Shared song not found' });
  res.json(song);
});

// Serve the shared song page (SPA fallback)
app.get('/share/:shareId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// SPA fallback
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Chord Finder running at http://localhost:${PORT}`);
});

process.on('SIGINT', () => {
  db.close();
  process.exit(0);
});
