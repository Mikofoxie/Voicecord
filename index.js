#!/usr/bin/env node
const fs = require('fs');
const readline = require('readline');
const { Readable } = require('stream');
const { Client, Options } = require('discord.js-selfbot-v13');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, VoiceConnectionStatus, entersState, StreamType, NoSubscriberBehavior } = require('@discordjs/voice');

// --- 1. SETUP WIZARD ---
const setup = async () => {
  require('dotenv').config();
  const { TOKEN, GUILD_ID, CHANNEL_ID } = process.env;
  if (TOKEN && GUILD_ID && CHANNEL_ID) return;

  if (process.stdin.isTTY) {
    console.log('--- SETUP REQUIRED ---');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = (q) => new Promise(r => rl.question(q, a => r(a.trim())));
    const env = `TOKEN=${await ask('Token: ')}\nGUILD_ID=${await ask('Guild ID: ')}\nCHANNEL_ID=${await ask('Channel ID: ')}`;
    fs.writeFileSync('.env', env);
    rl.close();
    console.log('--- SAVED .ENV ---');
    require('dotenv').config();
  } else {
    console.error('FATAL: Missing ENV vars in non-interactive mode.');
    process.exit(1);
  }
};

// --- 2. UTILS & OPTIMIZATION ---
const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);

const silence = () => createAudioResource(new Readable({
    read() {
        this.push(Buffer.from([0xf8, 0xff, 0xfe]));
        this.push(null);
    }
}), { inputType: StreamType.Opus });

// --- 3. STATE & CACHE KILLER ---
const client = new Client({
  checkUpdate: false,
  patchVoice: true,
  makeCache: Options.cacheWithLimits({
    MessageManager: 0,
    PresenceManager: 0,
    UserManager: 0,
    GuildMemberManager: 0,
    ThreadManager: 0,
    ReactionManager: 0,
    GuildMessageManager: 0,
    GuildBanManager: 0,
    GuildInviteManager: 0,
    StageInstanceManager: 0,
    VoiceStateManager: 0,
  }),
});

let backoff = 1000;
let isConnecting = false;

// --- 4. CORE LOGIC ---
const connect = async () => {
  if (isConnecting) return;
  isConnecting = true;
  
  const { GUILD_ID, CHANNEL_ID } = process.env;
  
  try {
    log(`[VOICE] Connecting to channel ${CHANNEL_ID}...`);
    
    const conn = joinVoiceChannel({
      channelId: CHANNEL_ID, 
      guildId: GUILD_ID, 
      adapterCreator: client.guilds.cache.get(GUILD_ID)?.voiceAdapterCreator || client.guilds.forge(GUILD_ID).voiceAdapterCreator,
      selfDeaf: true,
      selfMute: true,
      group: client.user.id
    });

    const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } });
    conn.subscribe(player);
    player.play(silence());

    player.on('idle', () => setTimeout(() => player.play(silence()), 1000));
    player.on('error', () => {}); 
    
    conn.on(VoiceConnectionStatus.Disconnected, async () => {
      isConnecting = false;
      log('[VOICE] Disconnected! Waiting 10s for auto-recovery...');
      try {
        await Promise.race([
          entersState(conn, VoiceConnectionStatus.Signalling, 10000),
          entersState(conn, VoiceConnectionStatus.Connecting, 10000),
        ]);
        log('[VOICE] Connection recovered!');
      } catch (e) {
        log('[VOICE] Recovery failed, forcing reconnect...');
        try { conn.destroy(); } catch {} 
        retry('Link lost permanently'); 
      }
    });

    await entersState(conn, VoiceConnectionStatus.Ready, 30000);
    log(`[VOICE] SUCCESS: Connected to ${CHANNEL_ID}`);
    backoff = 1000;
    isConnecting = false;

  } catch (e) { 
      isConnecting = false;
      retry(e.message); 
  }
};

const retry = (msg) => {
  log(`[WARN] ${msg}. Retrying in ${backoff/1000}s`);
  setTimeout(connect, backoff);
  backoff = Math.min(backoff * 2, 60000);
};

// --- 5. BOOTSTRAP & WATCHDOG ---
client.on('ready', () => {
  log(`[SYSTEM] Login successful: ${client.user.tag}`);
  connect();
});

client.on('voiceStateUpdate', (oldState, newState) => {
    if (newState.id === client.user.id && newState.channelId !== process.env.CHANNEL_ID) {
        log('[WATCHDOG] Disconnected from channel! Reconnecting...');
        isConnecting = false;
        connect();
    }
});

setInterval(() => {
    if (global.gc) {
        global.gc();
        log('[MEMORY] Garbage collection triggered');
    }
}, 600000);

process.on('SIGINT', () => process.exit(0));
process.on('unhandledRejection', (e) => log(`[FATAL] Unhandled rejection: ${e.message}`));

(async () => {
  await setup();
  client.login(process.env.TOKEN).catch((e) => { 
      console.error(`[AUTH] Login failed: ${e.message}`); 
      process.exit(1); 
  });
})();