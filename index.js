const fs = require('fs');
const readline = require('readline');
const { Client, Options } = require('discord.js-selfbot-v13');
const { 
    joinVoiceChannel, 
    createAudioPlayer, 
    createAudioResource, 
    AudioPlayerStatus, 
    VoiceConnectionStatus, 
    entersState, 
    StreamType,
    NoSubscriberBehavior 
} = require('@discordjs/voice');
const { Readable } = require('stream'); 

class Silence extends Readable {
    _read() {
        this.push(Buffer.from([0xF8, 0xFF, 0xFE])); 
    }
}

const askQuestion = (query) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => rl.question(query, (ans) => { rl.close(); resolve(ans.trim()); }));
};

async function setupConfig() {
    const envPath = './.env';
    if (fs.existsSync(envPath)) {
        require('dotenv').config();
        if (process.env.TOKEN && process.env.GUILD_ID && process.env.CHANNEL_ID) return;
    }
    console.log("=== AUTO VOICE SETUP ===");
    const token = await askQuestion('1. User Token: ');
    const guildId = await askQuestion('2. Server ID: ');
    const channelId = await askQuestion('3. Channel ID: ');
    fs.writeFileSync(envPath, `TOKEN=${token}\nGUILD_ID=${guildId}\nCHANNEL_ID=${channelId}`);
    console.log("[OK] Config saved. Starting bot...\n");
    require('dotenv').config();
}

async function runBot() {
    await setupConfig();

    const client = new Client({ 
        checkUpdate: false,
        makeCache: Options.cacheWithLimits({
            MessageManager: 0,
            PresenceManager: 0,
            UserManager: 0,
            GuildMemberManager: 0,
            ThreadManager: 0,
            ApplicationCommandManager: 0,
        }),
    });

    let connection = null;
    let player = null;
    let isReconnecting = false;

    function playSilence() {
        if (!player) return;
        const resource = createAudioResource(new Silence(), { 
            inputType: StreamType.Opus,
            inlineVolume: false 
        });
        player.play(resource);
    }

    async function connectToVoice() {
        if (isReconnecting) return;
        isReconnecting = true;

        const guild = client.guilds.cache.get(process.env.GUILD_ID);
        const channel = guild?.channels.cache.get(process.env.CHANNEL_ID);

        if (!guild || !channel) {
            console.log(`[RETRY] Server/Channel not ready. Retrying in 10s...`);
            isReconnecting = false;
            return setTimeout(connectToVoice, 10000);
        }

        try {
            if (connection) {
                connection.removeAllListeners(); 
                connection.destroy();
            }
            if (player) {
                player.stop();
            }
            
            if (guild.me?.voice?.channelId) {
                await guild.me.voice.disconnect().catch(() => {});
                await new Promise(r => setTimeout(r, 1000));
            }
        } catch (e) {}
        
        connection = null;
        player = null;

        console.log(`[CONNECT] Joining channel: ${channel.name}...`);

        try {
            connection = joinVoiceChannel({
                channelId: channel.id,
                guildId: guild.id,
                adapterCreator: guild.voiceAdapterCreator,
                selfDeaf: false,
                selfMute: true
            });

            player = createAudioPlayer({
                behaviors: { noSubscriber: NoSubscriberBehavior.Play },
            });

            player.on(AudioPlayerStatus.Idle, () => playSilence());
            player.on('error', () => playSilence());

            playSilence();
            connection.subscribe(player);

            console.log("[OK] Voice connected & Streaming silence!");
            isReconnecting = false;

            connection.on(VoiceConnectionStatus.Disconnected, async () => {
                console.warn("[WARN] Connection lost! Waiting for recovery...");
                try {
                    await Promise.race([
                        entersState(connection, VoiceConnectionStatus.Signalling, 20_000),
                        entersState(connection, VoiceConnectionStatus.Connecting, 20_000),
                    ]);
                    console.log("[INFO] Connection recovered.");
                } catch (error) {
                    console.error("[ERROR] Network fatal. Re-joining in 30s...");
                    if (connection) connection.destroy();
                    isReconnecting = false;
                    setTimeout(connectToVoice, 30000); 
                }
            });

        } catch (error) {
            console.error("[ERR] Join failed:", error.message);
            isReconnecting = false;
            setTimeout(connectToVoice, 30000);
        }
    }

    client.on('ready', () => {
        console.log(`[BOT] Logged in as: ${client.user.tag}`);
        connectToVoice();

        setInterval(() => {
            if (isReconnecting) return;
            const guild = client.guilds.cache.get(process.env.GUILD_ID);
            const me = guild?.members?.me; 
            
            if (!me?.voice?.channelId || me.voice.channelId !== process.env.CHANNEL_ID) {
                console.log("[WATCHDOG] Bot disconnected. Re-connecting...");
                connectToVoice();
            } else if (player && player.state.status === AudioPlayerStatus.Idle) {
                 playSilence();
            }
        }, 120000);
    });

    client.login(process.env.TOKEN).catch(e => {
        console.log("[FATAL] Invalid Token.");
        process.exit(1);
    });
}

process.on('unhandledRejection', (err) => {});
process.on('uncaughtException', (err) => {});

runBot();
