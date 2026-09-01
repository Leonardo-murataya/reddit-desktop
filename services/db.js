const fs = require('fs');
const path = require('path');

function getDbPath() {
  const localDb = path.join(__dirname, '..', 'db.json');
  try {
    const localDir = path.join(__dirname, '..');
    const testFile = path.join(localDir, '.write_test');
    fs.writeFileSync(testFile, '1');
    fs.unlinkSync(testFile);
    if (!__dirname.includes('_up_') && !__dirname.includes('Program Files')) {
      return localDb;
    }
  } catch (e) {}

  if (process.env.APPDATA) {
    const userDir = path.join(process.env.APPDATA, 'Reddit Video Generator');
    if (!fs.existsSync(userDir)) {
      try { fs.mkdirSync(userDir, { recursive: true }); } catch (e) {}
    }
    const userDb = path.join(userDir, 'db.json');
    if (!fs.existsSync(userDb) && fs.existsSync(localDb)) {
      try { fs.copyFileSync(localDb, userDb); } catch (e) {}
    }
    return userDb;
  }

  return localDb;
}

const DB_PATH = getDbPath();

const INITIAL_DB = {
  profiles: [],
  templates: [
    {
      id: 'default-template',
      name: 'TikTok Reddit Pop (Negro/Amarillo)',
      maleVoice: 'es-MX-JorgeNeural',
      femaleVoice: 'es-MX-DaliaNeural',
      font: 'Arial Bold',
      fontSize: 100,
      subtitleColor: '#FFFF00', // Yellow active
      passiveColor: '#FFFFFF', // White passive
      animation: 'tiktok-pop',
      cardTheme: 'dark',
      cardAvatar: 'https://www.redditstatic.com/avatars/avatar_default_02_FF4500.png',
      cardUsername: 'reddit_stories',
      cardSubreddit: 'r/AskReddit',
      upvotes: '14.5k',
      comments: '1.2k',
      showShare: true
    }
  ],
  timeline: {
    currentVideoIndex: 0,
    currentOffset: 0,
    backgroundVideos: [] // List of local video paths
  },
  settings: {
    exportFolder: path.join(process.env.USERPROFILE || 'C:\\', 'Desktop', 'redit_exports'),
    defaultProfileId: 'default-gemini',
    defaultTemplateId: 'default-template'
  }
};

function readDb() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      fs.writeFileSync(DB_PATH, JSON.stringify(INITIAL_DB, null, 2), 'utf8');
      return INITIAL_DB;
    }
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading local db.json:', error);
    return INITIAL_DB;
  }
}

function writeDb(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error writing to local db.json:', error);
    return false;
  }
}

module.exports = {
  readDb,
  writeDb
};
