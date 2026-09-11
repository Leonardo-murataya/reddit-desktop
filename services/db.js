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
    if (!fs.existsSync(userDb)) {
      const defaultDbPath = path.join(__dirname, '..', 'default_db.json');
      if (fs.existsSync(defaultDbPath)) {
        try { fs.copyFileSync(defaultDbPath, userDb); } catch (e) {}
      } else {
        try { fs.writeFileSync(userDb, JSON.stringify(INITIAL_DB, null, 2), 'utf8'); } catch (e) {}
      }
    }
    return userDb;
  }

  return localDb;
}

const DB_PATH = getDbPath();

const INITIAL_DB = {
  profiles: [
    {
      id: 'default-gemini',
      name: 'Perfil Estándar Gemini',
      apiKey: '',
      model: 'gemini-3.8-flash',
      systemPrompt: 'Eres un narrador experto de historias de Reddit. Genera historias cautivadoras, intrigantes y realistas que mantengan al espectador enganchado segundo a segundo.',
      backgroundFolder: '',
      primaryAttempts: 2,
      fallbackAttempts: 3,
      maxAttempts: 5,
      fallbackModel: 'gemini-3.7-flash',
      fallbackModels: [
        'gemini-3.8-flash',
        'gemini-3.7-flash',
        'gemini-3.6-flash',
        'gemini-3.5-flash'
      ],
      renderEngine: 'global',
      cleanTxtReport: false,
      hashtags: '#HistoriasDeReddit #RedditEnEspañol #reddit',
      reportFolderSameAsVideo: true,
      reportFolder: ''
    }
  ],
  templates: [
    {
      id: 'default-template',
      name: 'TikTok Reddit Pop (Negro/Amarillo)',
      profileId: 'default-gemini',
      maleVoice: 'es-MX-JorgeNeural',
      femaleVoice: 'es-MX-DaliaNeural',
      font: 'Arial Bold',
      fontSize: 100,
      subtitleColor: '#FFFF00', // Yellow active
      passiveColor: '#FFFFFF', // White passive
      animation: 'tiktok-pop',
      cardTheme: 'dark',
      cardAvatar: '/assets/reddit-avatar.png',
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
    backgroundVideos: []
  },
  settings: {
    exportFolder: '',
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
