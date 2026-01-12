/**
 * PROJECT: Voicefoxcord (Node.js Edition)
 * PURPOSE: High-resilience Discord Voice Keep-Alive
 * OPTIMIZATIONS: Zero-Allocation Silence, Network Jitter Handling, TempVoice Protection
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
// Pre-allocate a single buffer for silence to reduce Garbage Collection overhead
const SILENCE_FRAME = Buffer.from([0xF8, 0xFF, 0xFE]);

class Silence extends Readable {
    _read() { this.push(SILENCE_FRAME); } 
}


const ask = (q) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((r) => rl.question(q, (a) => { rl.close(); r(a.trim()); }));
};

async function setup() {
    if (fs.existsSync('./.env')) { require('dotenv').config(); return; }
    
    console.log("--- CONFIGURATION SETUP ---");
    const t = await ask('User Token: ');
    const g = await ask('Guild ID: ');
    const c = await ask('Channel ID: ');
    
    fs.writeFileSync('./.env', `TOKEN=${t}\nGUILD_ID=${g}\nCHANNEL_ID=${c}`);
    console.log("[INFO] Configuration saved.");
    require('dotenv').config();
}


async function run() {
    await setup();

    // Initialize Client with aggressive caching disabled to minimize RAM usage
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
            VoiceStateManager: 10
        }),
    });

    let connection = null;
    let player = null;
    let isReconnecting = false;

    // Helper to inject silent frames into the UDP stream
    function playSilence() {
        if (!player) return;
        const r = createAudioResource(new Silence(), { inputType: StreamType.Opus });
        player.play(r);
    }

    async function connect() {
        // Prevent concurrent connection attempts
        if (isReconnecting) return;
        isReconnecting = true;

        const guild = client.guilds.cache.get(process.env.GUILD_ID);
        
        // Ensure channel exists in cache, fetch if necessary
        let channel = guild?.channels.cache.get(process.env.CHANNEL_ID);
        if (!channel) {
            try { 
                channel = await client.channels.fetch(process.env.CHANNEL_ID); 
            } catch { 
                console.error("[ERROR] Channel not found or deleted. Retrying in 10s..."); 
                isReconnecting = false;
                return setTimeout(connect, 10000); 
            }
        }


        // Destroy local connection instance but DO NOT force disconnect from Gateway
        // This preserves "Zombie Connection" status to keep TempVoice channels alive
        try { if (connection) connection.destroy(); } catch {}

        console.log(`[NET] Connecting to channel: ${channel.name}...`);

        try {
            connection = joinVoiceChannel({
                channelId: channel.id, 
                guildId: guild.id,
                adapterCreator: guild.voiceAdapterCreator,
                selfDeaf: false, 
                selfMute: true
            });

            // Audio Player Setup
            player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } });
            
            // Auto-replay silence on idle or error
            player.on(AudioPlayerStatus.Idle, () => playSilence());
            player.on('error', () => playSilence());

            playSilence();
            connection.subscribe(player);
            
            console.log("[OK] Connection established. Streaming silence.");
            isReconnecting = false;

            // === NETWORK RESILIENCE HANDLER ===
            connection.on(VoiceConnectionStatus.Disconnected, async () => {
                console.warn("[WARN] Connection lost. Waiting for recovery...");
                try {
                    await Promise.race([
                        entersState(connection, VoiceConnectionStatus.Signalling, 120_000),
                        entersState(connection, VoiceConnectionStatus.Connecting, 120_000),
                    ]);
                    console.log("[INFO] Connection recovered.");
                } catch {
                    console.warn("[WARN] Recovery failed. Re-initializing connection...");
                    if (connection) connection.destroy();
                    isReconnecting = false;
                    setTimeout(connect, 2000);
                }
            });

        } catch (e) {
            console.error(`[ERR] Join failed: ${e.message}`);
            isReconnecting = false;
            setTimeout(connect, 10000);
        }
    }

    client.on('ready', () => {
        console.log(`[SYS] Logged in as: ${client.user.tag}`);
        connect();
        

        setInterval(() => {
            if (isReconnecting) return;
            
            const me = client.guilds.cache.get(process.env.GUILD_ID)?.members?.me;
            
            if (!me?.voice?.channelId || me.voice.channelId !== process.env.CHANNEL_ID) {
                 console.log("[WATCHDOG] Bot disconnected from channel. Reconnecting...");
                 connect();
            }
        }, 60000);
    });

    client.login(process.env.TOKEN).catch(() => {
        console.error("[FATAL] Invalid Token."); 
        process.exit(1);
    });
}

// Global Error Handlers (Prevent crash)
process.on('unhandledRejection', (e) => {});
process.on('uncaughtException', (e) => {});

run();