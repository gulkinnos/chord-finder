# 🎸 Chord Finder

A full-stack guitar chord lookup web application that allows users to search for chords online, save them to a local database, edit saved songs, and share them via WhatsApp, Telegram, or other platforms.

## ✨ Features

### 🔍 Chord Search
- **Ultimate Guitar Integration**: Search and extract chords from Ultimate Guitar
- **Russian Site Support**: Search Russian chord sites (AMDM.ru) for Cyrillic queries
- **Automatic Language Detection**: Detects Cyrillic characters and routes to appropriate sources
- **Chord Content Extraction**: Automatically extracts chord content from supported sites

### 💾 Song Management
- **Save Songs**: Save chord content with title, artist, source URL, and personal notes
- **Edit Songs**: Full CRUD operations - create, read, update, delete
- **Search Saved Songs**: Search through your saved songs by title, artist, or content
- **Personal Notes**: Add your own notes and modifications to saved songs

### 📤 Sharing Features
- **Unique Share URLs**: Each saved song gets a unique shareable URL
- **WhatsApp Integration**: Direct sharing to WhatsApp with pre-filled message
- **Telegram Integration**: Share directly to Telegram
- **Native Share API**: Use device's native sharing on mobile devices
- **Copy Link**: Copy share URL to clipboard

### 🎨 User Interface
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Modern UI**: Clean, intuitive interface with smooth animations
- **Tab-based Navigation**: Easy switching between search and saved songs
- **Modal Editing**: In-place editing with modal dialogs
- **Real-time Feedback**: Loading states, success/error messages

## 🛠️ Technical Stack

- **Backend**: Node.js, Express.js
- **Database**: SQLite with better-sqlite3
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Web Scraping**: Axios, Cheerio
- **Deployment**: Render.com (free tier)

## 📁 Project Structure

```
chord-finder/
├── db/
│   └── database.js          # SQLite database setup and operations
├── public/
│   └── index.html          # Frontend application
├── server.js               # Express server and API endpoints
├── test.js                 # Comprehensive test suite
├── package.json            # Dependencies and scripts
├── .gitignore             # Git ignore rules
└── README.md              # This file
```

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Local Development

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd chord-finder
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the server**
   ```bash
   npm start
   ```

4. **Open your browser**
   ```
   http://localhost:3000
   ```

### Running Tests

```bash
# Make sure the server is running first
npm start

# In another terminal, run tests
npm test
```

## 🌐 API Endpoints

### Chord Search
- `GET /api/chords?q=<query>` - Search for chords online
- `POST /api/extract-chords` - Extract chord content from URL

### Song Management
- `GET /api/songs` - Get all saved songs
- `GET /api/songs/:id` - Get song by ID
- `POST /api/songs` - Save new song
- `PUT /api/songs/:id` - Update song
- `DELETE /api/songs/:id` - Delete song
- `GET /api/search?q=<query>` - Search saved songs

### Sharing
- `GET /share/:shareId` - View shared song

## 📊 Database Schema

```sql
CREATE TABLE songs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    share_id TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    chord_content TEXT NOT NULL,
    source_url TEXT,
    personal_notes TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 🚀 Deployment to Render.com

### Step-by-Step Deployment Guide

#### 1. Prepare Your Repository
```bash
# Make sure all files are committed
git add .
git commit -m "Ready for deployment"
git push origin main
```

#### 2. Create Render Account
1. Go to [render.com](https://render.com)
2. Sign up with your GitHub account
3. Authorize Render to access your repositories

#### 3. Create Web Service
1. Click "New +" → "Web Service"
2. Connect your GitHub repository
3. Select your `chord-finder` repository

#### 4. Configure Deployment Settings
```
Name: chord-finder
Branch: main
Build Command: npm install
Start Command: npm start
Instance Type: Free
```

#### 5. Environment Variables (Optional)
- No environment variables required for basic setup
- The app uses `process.env.PORT` which Render provides automatically

#### 6. Deploy
1. Click "Create Web Service"
2. Wait for deployment (usually 2-3 minutes)
3. Your app will be available at `https://chord-finder-xxxx.onrender.com`

### Important Notes for Render Deployment

#### Database Persistence
- **Free Tier Limitation**: SQLite database resets on each deployment
- **For Production**: Consider upgrading to a paid plan with persistent storage or using Render's PostgreSQL addon

#### Cold Starts
- Free tier services sleep after 15 minutes of inactivity
- First request after sleep takes ~30 seconds to wake up
- Subsequent requests are fast

#### Custom Domain (Optional)
- Render provides a free subdomain
- Custom domains available on paid plans

## 🧪 Testing

The application includes a comprehensive test suite that validates:

- ✅ Database operations (CRUD)
- ✅ API endpoints
- ✅ Chord search functionality
- ✅ Share functionality
- ✅ Error handling
- ✅ Static file serving

### Test Coverage
- Database operations: Create, read, update, delete, search
- API endpoints: All REST endpoints with proper error handling
- Chord scraping: Ultimate Guitar and Russian sites
- Share functionality: Unique URLs and proper rendering
- Error cases: Invalid inputs, missing data, network errors

## 🔧 Configuration

### Supported Chord Sites
- **Ultimate Guitar**: English songs, comprehensive chord database
- **AMDM.ru**: Russian songs, Cyrillic character support

### Customization Options
- Modify `hasCyrillic()` function to support other languages
- Add new chord sites by implementing scraping functions
- Customize UI colors and styling in the CSS section
- Add new sharing platforms in the frontend JavaScript

## 🐛 Troubleshooting

### Common Issues

#### Server Won't Start
```bash
# Check if port 3000 is in use
lsof -i :3000

# Kill process if needed
kill -9 <PID>
```

#### Database Issues
```bash
# Delete database file to reset
rm db/songs.db

# Restart server to recreate database
npm start
```

#### Chord Scraping Fails
- Some sites may block automated requests
- Ultimate Guitar may change their HTML structure
- Check console logs for specific error messages

#### Deployment Issues
- Ensure all dependencies are in `package.json`
- Check Render logs for specific error messages
- Verify build and start commands are correct

## 📝 License

MIT License - feel free to use this project for personal or commercial purposes.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests to ensure everything works
5. Submit a pull request

## 📞 Support

If you encounter any issues:

1. Check the troubleshooting section above
2. Run the test suite to identify specific problems
3. Check browser console for frontend errors
4. Review server logs for backend issues

## 🎯 Future Enhancements

- [ ] User authentication and personal accounts
- [ ] Chord transposition tools
- [ ] Playlist/setlist management
- [ ] Export to PDF functionality
- [ ] Offline mode with service workers
- [ ] Advanced search filters
- [ ] Chord diagram generation
- [ ] Integration with more chord sites

---

**Happy chord hunting! 🎸**