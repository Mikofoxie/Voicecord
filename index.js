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

// --- 2. UTILS ---
const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);
const silence = () => createAudioResource(new Readable({ read() { this.push(Buffer.from([0xf8, 0xff, 0xfe])); } }), { inputType: StreamType.Opus });

// --- 3. STATE & CONFIG ---
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
    VoiceStateManager: Infinity,
  }),
});

let backoff = 1000;

// --- 4. CORE LOGIC ---
const connect = async () => {
  const { GUILD_ID, CHANNEL_ID } = process.env;
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return retry('Guild miss');

  try {
    const conn = joinVoiceChannel({
      channelId: CHANNEL_ID, guildId: GUILD_ID, adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: false, selfMute: true, group: client.user.id
    });

    const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } });
    conn.subscribe(player);
    player.play(silence());

    player.on('idle', () => player.play(silence()));
    player.on('error', () => {}); 
    
    conn.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(conn, VoiceConnectionStatus.Signalling, 5000),
          entersState(conn, VoiceConnectionStatus.Connecting, 5000),
        ]);
      } catch { try { conn.destroy(); } catch {} retry('Link lost'); }
    });

    // Timeout 1m30s for slow networks
    await entersState(conn, VoiceConnectionStatus.Ready, 90000);
    log(`CONNECTED: ${CHANNEL_ID}`);
    backoff = 1000;

  } catch (e) { retry(e.message); }
};

const retry = (msg) => {
  log(`WARN: ${msg}. Retry ${backoff/1000}s`);
  setTimeout(connect, backoff);
  backoff = Math.min(backoff * 2, 60000);
};

// --- 5. BOOTSTRAP ---
client.on('ready', () => {
  log(`USER: ${client.user.tag}`);
  connect();
  setInterval(() => {
    if (client.guilds.cache.get(process.env.GUILD_ID)?.members?.me?.voice?.channelId !== process.env.CHANNEL_ID) retry('Watchdog');
  }, 60000);
});

process.on('SIGINT', () => process.exit(0));
process.on('unhandledRejection', () => {});

(async () => {
  await setup();
  client.login(process.env.TOKEN).catch(() => { console.error('Auth failed'); process.exit(1); });
})();
