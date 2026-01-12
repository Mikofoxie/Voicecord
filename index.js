/**
 * SYSTEM: Voicecord (Optimized for ARM/Low-end)
 * FEATURES: Static Memory, Ghost Connection Fix, Aggressive Caching
 */

const fs = require('fs');
const readline = require('readline');
const { Client, Options } = require('discord.js-selfbot-v13');
const { 
    joinVoiceChannel, createAudioPlayer, createAudioResource, 
    AudioPlayerStatus, VoiceConnectionStatus, entersState, 
    StreamType, NoSubscriberBehavior 
} = require('@discordjs/voice');
const { Readable } = require('stream'); 

// === MEMORY OPTIMIZATION ===
// Pre-allocate buffer to prevent GC spikes (CPU 100% fix)
const SILENCE_FRAME = Buffer.from([0xF8, 0xFF, 0xFE]);

class Silence extends Readable {
    _read() { this.push(SILENCE_FRAME); } // Zero allocation
}

// === CONFIGURATION ===
const ask = (q) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((r) => rl.question(q, (a) => { rl.close(); r(a.trim()); }));
};

async function setup() {
    if (fs.existsSync('./.env')) { require('dotenv').config(); return; }
    const t = await ask('Token: ');
    const g = await ask('Guild ID: ');
    const c = await ask('Channel ID: ');
    fs.writeFileSync('./.env', `TOKEN=${t}\nGUILD_ID=${g}\nCHANNEL_ID=${c}`);
    require('dotenv').config();
}

// === BOT LOGIC ===
async function run() {
    await setup();

    // Disable caching to save RAM
    const client = new Client({ 
        checkUpdate: false, patchVoice: true,
        makeCache: Options.cacheWithLimits({
            MessageManager: 0, PresenceManager: 0, UserManager: 0,
            GuildMemberManager: 0, ThreadManager: 0, ReactionManager: 0,
            VoiceStateManager: 10 // Minimal cache for voice tracking
        }),
    });

    let connection = null;
    let player = null;
    let isReconnecting = false;

    function playSilence() {
        if (!player || player.state.status === AudioPlayerStatus.Playing) return;
        const r = createAudioResource(new Silence(), { inputType: StreamType.Opus });
        player.play(r);
    }

    async function connect() {
        if (isReconnecting) return;
        isReconnecting = true;

        const guild = client.guilds.cache.get(process.env.GUILD_ID);
        // Fetch to ensure channel exists (Fix TempVoice deletion issue)
        let channel = guild?.channels.cache.get(process.env.CHANNEL_ID);
        if (!channel) {
            try { channel = await client.channels.fetch(process.env.CHANNEL_ID); } 
            catch { console.log("[ERR] Channel not found/deleted."); isReconnecting = false; return; }
        }

        // === GHOST BUSTER PROTOCOL ===
        // Force Gateway disconnect to kill zombie sessions
        try { if (guild.me?.voice?.channelId) await guild.me.voice.disconnect(); } catch {}
        try { if (connection) connection.destroy(); } catch {}

        console.log(`[NET] Connecting to ${channel.name}...`);

        try {
            connection = joinVoiceChannel({
                channelId: channel.id, guildId: guild.id,
                adapterCreator: guild.voiceAdapterCreator,
                selfDeaf: false, selfMute: true
            });

            player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } });
            
            player.on(AudioPlayerStatus.Idle, () => {
                if (connection?.state.status !== VoiceConnectionStatus.Destroyed) playSilence();
            });
            player.on('error', () => setTimeout(playSilence, 1000));

            playSilence();
            connection.subscribe(player);
            console.log("[OK] Connected.");
            isReconnecting = false;

            // === NETWORK RESILIENCE ===
            connection.on(VoiceConnectionStatus.Disconnected, async () => {
                console.warn("[WARN] Disconnected. Checking network...");
                try {
                    // Phase 1: Wait 5s for auto-recovery
                    await Promise.race([
                        entersState(connection, VoiceConnectionStatus.Signalling, 5000),
                        entersState(connection, VoiceConnectionStatus.Connecting, 5000),
                    ]);
                    console.log("[INFO] Auto-recovered.");
                } catch {
                    // Phase 2: Force Reconnect
                    console.warn("[WARN] Hard disconnect. Re-initializing...");
                    if (connection) connection.destroy();
                    isReconnecting = false;
                    setTimeout(connect, Math.random() * 2000 + 1000); // Jitter delay
                }
            });

        } catch (e) {
            console.error(`[ERR] Join failed: ${e.message}`);
            isReconnecting = false;
            setTimeout(connect, 5000);
        }
    }

    client.on('ready', () => {
        console.log(`[SYS] Logged as ${client.user.tag}`);
        connect();
        
        // Watchdog: Check every 60s
        setInterval(() => {
            const me = client.guilds.cache.get(process.env.GUILD_ID)?.members?.me;
            if (!me?.voice?.channelId || me.voice.channelId !== process.env.CHANNEL_ID) connect();
        }, 60000);
    });

    client.login(process.env.TOKEN).catch(() => process.exit(1));
}

// Anti-Crash
process.on('unhandledRejection', (e) => console.log(`[LOG] ${e.message}`));
process.on('uncaughtException', (e) => console.log(`[LOG] ${e.message}`));

run();