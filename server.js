const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const { songOperations } = require('./db/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Helper function to detect Cyrillic characters
function hasCyrillic(text) {
  return /[\u0400-\u04FF]/.test(text);
}

// Helper function to scrape Ultimate Guitar
async function scrapeUltimateGuitar(query) {
  try {
    const searchUrl = `https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(query)}`;
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    const results = [];

    // Parse search results
    $('article.dNNhl').each((i, element) => {
      if (i >= 10) return false; // Limit to 10 results
      
      const $el = $(element);
      const title = $el.find('a.fZjdD').text().trim();
      const artist = $el.find('a.c5K8n').text().trim();
      const url = $el.find('a.fZjdD').attr('href');
      const type = $el.find('.tdi3Y').text().trim();
      
      if (title && artist && url) {
        results.push({
          title,
          artist,
          url: url.startsWith('http') ? url : `https://www.ultimate-guitar.com${url}`,
          type: type || 'Chords',
          source: 'Ultimate Guitar'
        });
      }
    });

    return results;
  } catch (error) {
    console.error('Ultimate Guitar scraping error:', error.message);
    return [];
  }
}

// Helper function to scrape Russian chord site (amdm.ru)
async function scrapeAmdmRu(query) {
  try {
    const searchUrl = `https://amdm.ru/search/?q=${encodeURIComponent(query)}`;
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    const results = [];

    // Parse search results
    $('.search_result').each((i, element) => {
      if (i >= 10) return false; // Limit to 10 results
      
      const $el = $(element);
      const $link = $el.find('a').first();
      const title = $link.text().trim();
      const url = $link.attr('href');
      
      if (title && url) {
        // Extract artist from title (usually in format "Artist - Song")
        const parts = title.split(' - ');
        const artist = parts.length > 1 ? parts[0] : 'Unknown';
        const songTitle = parts.length > 1 ? parts.slice(1).join(' - ') : title;
        
        results.push({
          title: songTitle,
          artist,
          url: url.startsWith('http') ? url : `https://amdm.ru${url}`,
          type: 'Chords',
          source: 'AMDM.ru'
        });
      }
    });

    return results;
  } catch (error) {
    console.error('AMDM.ru scraping error:', error.message);
    return [];
  }
}

// Helper function to extract chord content from Ultimate Guitar
async function extractUGChords(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 15000
    });

    const $ = cheerio.load(response.data);
    
    // Try to find chord content in various possible containers
    let chordContent = '';
    
    // Method 1: Look for pre-formatted chord content
    const preContent = $('pre').text().trim();
    if (preContent && preContent.length > 50) {
      chordContent = preContent;
    }
    
    // Method 2: Look for chord content in specific UG containers
    if (!chordContent) {
      const ugContent = $('.js-tab-content pre, .js-tab-content code, [data-name="tab-content"] pre').text().trim();
      if (ugContent && ugContent.length > 50) {
        chordContent = ugContent;
      }
    }
    
    // Method 3: Extract from script tags (UG sometimes embeds chord data in JS)
    if (!chordContent) {
      $('script').each((i, script) => {
        const scriptContent = $(script).html();
        if (scriptContent && scriptContent.includes('tab_view_type') && scriptContent.includes('content')) {
          try {
            // Try to extract chord content from JS data
            const match = scriptContent.match(/"content":"([^"]+)"/);
            if (match && match[1]) {
              chordContent = match[1].replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\/g, '');
            }
          } catch (e) {
            // Continue if parsing fails
          }
        }
      });
    }
    
    return chordContent || 'Could not extract chord content from this page.';
  } catch (error) {
    console.error('Error extracting UG chords:', error.message);
    return 'Error loading chord content.';
  }
}

// Helper function to extract chord content from AMDM.ru
async function extractAmdmChords(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 15000
    });

    const $ = cheerio.load(response.data);
    
    // AMDM.ru typically stores chords in pre tags or specific containers
    let chordContent = '';
    
    // Method 1: Look for pre-formatted content
    const preContent = $('pre').text().trim();
    if (preContent && preContent.length > 50) {
      chordContent = preContent;
    }
    
    // Method 2: Look for chord content in specific containers
    if (!chordContent) {
      const contentDiv = $('.song_text, .chord_text, .song-text').text().trim();
      if (contentDiv && contentDiv.length > 50) {
        chordContent = contentDiv;
      }
    }
    
    return chordContent || 'Could not extract chord content from this page.';
  } catch (error) {
    console.error('Error extracting AMDM chords:', error.message);
    return 'Error loading chord content.';
  }
}

// API Routes

// Search for chords
app.get('/api/chords', async (req, res) => {
  try {
    const { q: query } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    let results = [];

    if (hasCyrillic(query)) {
      // Search Russian sites for Cyrillic queries
      results = await scrapeAmdmRu(query);
    } else {
      // Search Ultimate Guitar for English queries
      results = await scrapeUltimateGuitar(query);
    }

    // If no results found, provide fallback links
    if (results.length === 0) {
      results = [
        {
          title: `Search "${query}" on Ultimate Guitar`,
          artist: 'External Link',
          url: `https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(query)}`,
          type: 'Search',
          source: 'Ultimate Guitar'
        },
        {
          title: `Search "${query}" on Chordify`,
          artist: 'External Link',
          url: `https://chordify.net/search/${encodeURIComponent(query)}`,
          type: 'Search',
          source: 'Chordify'
        }
      ];
    }

    res.json({ results });
  } catch (error) {
    console.error('Chord search error:', error);
    res.status(500).json({ error: 'Failed to search for chords' });
  }
});

// Extract chord content from URL
app.post('/api/extract-chords', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    let chordContent = '';
    
    if (url.includes('ultimate-guitar.com')) {
      chordContent = await extractUGChords(url);
    } else if (url.includes('amdm.ru')) {
      chordContent = await extractAmdmChords(url);
    } else {
      chordContent = 'Chord extraction not supported for this site.';
    }

    res.json({ chord_content: chordContent });
  } catch (error) {
    console.error('Chord extraction error:', error);
    res.status(500).json({ error: 'Failed to extract chord content' });
  }
});

// Get all saved songs
app.get('/api/songs', (req, res) => {
  try {
    const songs = songOperations.getAll();
    res.json({ songs });
  } catch (error) {
    console.error('Error fetching songs:', error);
    res.status(500).json({ error: 'Failed to fetch songs' });
  }
});

// Get song by ID
app.get('/api/songs/:id', (req, res) => {
  try {
    const song = songOperations.getById(req.params.id);
    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }
    res.json({ song });
  } catch (error) {
    console.error('Error fetching song:', error);
    res.status(500).json({ error: 'Failed to fetch song' });
  }
});

// Save a new song
app.post('/api/songs', (req, res) => {
  try {
    const { title, artist, chord_content, source_url, personal_notes } = req.body;
    
    if (!title || !artist || !chord_content) {
      return res.status(400).json({ error: 'Title, artist, and chord content are required' });
    }

    const result = songOperations.create({
      title,
      artist,
      chord_content,
      source_url,
      personal_notes
    });

    res.json({ 
      message: 'Song saved successfully',
      id: result.id,
      share_id: result.share_id
    });
  } catch (error) {
    console.error('Error saving song:', error);
    res.status(500).json({ error: 'Failed to save song' });
  }
});

// Update a song
app.put('/api/songs/:id', (req, res) => {
  try {
    const { title, artist, chord_content, source_url, personal_notes } = req.body;
    
    if (!title || !artist || !chord_content) {
      return res.status(400).json({ error: 'Title, artist, and chord content are required' });
    }

    const success = songOperations.update(req.params.id, {
      title,
      artist,
      chord_content,
      source_url,
      personal_notes
    });

    if (!success) {
      return res.status(404).json({ error: 'Song not found' });
    }

    res.json({ message: 'Song updated successfully' });
  } catch (error) {
    console.error('Error updating song:', error);
    res.status(500).json({ error: 'Failed to update song' });
  }
});

// Delete a song
app.delete('/api/songs/:id', (req, res) => {
  try {
    const success = songOperations.delete(req.params.id);
    
    if (!success) {
      return res.status(404).json({ error: 'Song not found' });
    }

    res.json({ message: 'Song deleted successfully' });
  } catch (error) {
    console.error('Error deleting song:', error);
    res.status(500).json({ error: 'Failed to delete song' });
  }
});

// Share song by share ID
app.get('/share/:shareId', (req, res) => {
  try {
    const song = songOperations.getByShareId(req.params.shareId);
    
    if (!song) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Song Not Found</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
        </head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1>Song Not Found</h1>
          <p>The shared song could not be found.</p>
          <a href="/">Go to Chord Finder</a>
        </body>
        </html>
      `);
    }

    // Return a simple HTML page with the song
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${song.title} - ${song.artist}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
          .song-header { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
          .chord-content { white-space: pre-wrap; font-family: monospace; background: #f5f5f5; padding: 20px; border-radius: 5px; }
          .notes { background: #fff3cd; padding: 15px; border-radius: 5px; margin-top: 20px; }
          .back-link { display: inline-block; margin-top: 20px; color: #007bff; text-decoration: none; }
        </style>
      </head>
      <body>
        <div class="song-header">
          <h1>${song.title}</h1>
          <h2>by ${song.artist}</h2>
          ${song.source_url ? `<p><a href="${song.source_url}" target="_blank">Original Source</a></p>` : ''}
        </div>
        <div class="chord-content">${song.chord_content}</div>
        ${song.personal_notes ? `<div class="notes"><strong>Notes:</strong><br>${song.personal_notes}</div>` : ''}
        <a href="/" class="back-link">← Back to Chord Finder</a>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Error sharing song:', error);
    res.status(500).send('Error loading shared song');
  }
});

// Search saved songs
app.get('/api/search', (req, res) => {
  try {
    const { q: query } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    const songs = songOperations.search(query);
    res.json({ songs });
  } catch (error) {
    console.error('Error searching songs:', error);
    res.status(500).json({ error: 'Failed to search songs' });
  }
});

// Serve the main application
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Chord Finder server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to use the application`);
});

module.exports = app;