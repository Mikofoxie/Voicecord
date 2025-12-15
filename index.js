const fs = require('fs');
const readline = require('readline');
const { Client } = require('discord.js-selfbot-v13');
const { 
    joinVoiceChannel, 
    createAudioPlayer, 
    createAudioResource, 
    AudioPlayerStatus, 
    VoiceConnectionStatus, 
    entersState, 
    NoSubscriberBehavior 
} = require('@discordjs/voice');

const path = require('path');

// --- HELPER FUNCTIONS ---
const askQuestion = (query) => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve) => rl.question(query, (ans) => {
        rl.close();
        resolve(ans.trim());
    }));
};

async function setupConfig() {
    const envPath = './.env';

    if (fs.existsSync(envPath)) {
        require('dotenv').config();
        if (process.env.TOKEN && process.env.GUILD_ID && process.env.CHANNEL_ID) {
            return; 
        }
        console.log("[!] .env file is missing information. Please re-enter.");
    }

    console.log("==========================================");
    console.log("        DISCORD VOICE KEEPER SETUP        ");
    console.log("==========================================");
    
    const token = await askQuestion('1. Enter your User Token: ');
    const guildId = await askQuestion('2. Enter Server ID (Guild ID): ');
    const channelId = await askQuestion('3. Enter Voice Channel ID: ');

    if (!token || !guildId || !channelId) {
        console.error("[!] Error: Input cannot be empty!");
        process.exit(1);
    }

    const envContent = `TOKEN=${token}\nGUILD_ID=${guildId}\nCHANNEL_ID=${channelId}`;
    
    fs.writeFileSync(envPath, envContent);
    console.log("[OK] Configuration saved! Starting bot...\n");
    
    require('dotenv').config();
}

async function runBot() {
    await setupConfig();

    const client = new Client({ checkUpdate: false });
    

    let connection = null;
    let player = null;

    function playSilence(targetPlayer) {
        if (!targetPlayer) return;
        
        const resource = createAudioResource(path.join(__dirname, 'silence.mp3'), { 
            inlineVolume: true 
        });
        resource.volume.setVolume(0);
        targetPlayer.play(resource);
    }

    async function connectToVoice() {
        const guild = client.guilds.cache.get(process.env.GUILD_ID);
        if (!guild) return console.log(`[ERROR] Server ID not found: ${process.env.GUILD_ID}`);

        const channel = guild.channels.cache.get(process.env.CHANNEL_ID);
        if (!channel) return console.log(`[ERROR] Channel ID not found: ${process.env.CHANNEL_ID}`);

        console.log(`[INFO] Connecting to: ${channel.name} | Server: ${guild.name}`);

        try {
            connection = joinVoiceChannel({
                channelId: channel.id,
                guildId: guild.id,
                adapterCreator: guild.voiceAdapterCreator,
                selfDeaf: false,
                selfMute: true
            });

            // HANDLE NETWORK ERRORS (ENOTFOUND)
            connection.on('error', (error) => {
                console.warn(`[WARN] Network/Connection Error: ${error.message}`);
                try {
                    if (connection) connection.destroy();
                } catch (e) {}
                setTimeout(connectToVoice, 5000);
            });

            player = createAudioPlayer({
                behaviors: { noSubscriber: NoSubscriberBehavior.Play },
            });

            player.on(AudioPlayerStatus.Idle, () => {
                playSilence(player);
            });
            
            player.on('error', (error) => {
                console.warn(`[WARN] Player Error: ${error.message}`);
                playSilence(player);
            });

            playSilence(player);
            connection.subscribe(player);

            console.log("[OK] Voice connected successfully!");


            connection.on(VoiceConnectionStatus.Disconnected, async () => {
                console.warn("[WARN] Disconnected. Attempting to recover...");
                try {
                    await Promise.race([
                        entersState(connection, VoiceConnectionStatus.Signalling, 5000),
                        entersState(connection, VoiceConnectionStatus.Connecting, 5000),
                    ]);
                    

                    console.log("[INFO] Connection recovered! Resuming audio...");
                    

                    connection.subscribe(player);
                    playSilence(player);
                    
                } catch (error) {
                    console.error("[ERROR] Connection fatal. Restarting connection...");
                    if (connection) connection.destroy();
                    setTimeout(connectToVoice, 5000);
                }
            });

        } catch (error) {
            console.error("[ERROR] Error joining voice:", error);
            setTimeout(connectToVoice, 10000);
        }
    }

    client.on('ready', async () => {
        console.log(`[BOT] Logged in as: ${client.user.tag}`);
        connectToVoice();

        setInterval(() => {
            const guild = client.guilds.cache.get(process.env.GUILD_ID);
            const me = guild?.members?.me; 
            
            if (!me?.voice?.channelId || me.voice.channelId !== process.env.CHANNEL_ID) {
                console.log("[Watchdog] Bot disconnected, re-joining...");
                connectToVoice();
                return;
            }

            if (player && player.state.status === AudioPlayerStatus.Idle) {
                console.log("[Watchdog] Audio stopped (Idle state detected). Restarting stream...");
                playSilence(player);
            }
            
        }, 60000);
    });

    // Anti-Crash Handlers
    process.on('unhandledRejection', (reason, p) => {
        console.log('[Anti-Crash] Unhandled Rejection:', reason);
    });

    process.on('uncaughtException', (err, origin) => {
        console.log('[Anti-Crash] Uncaught Exception:', err);
    });

    client.login(process.env.TOKEN).catch(err => {
        console.error("[ERROR] Login failed: Invalid Token or Account Disabled.");
        try {
            fs.unlinkSync('./.env'); 
            console.log("[INFO] Old config file deleted. Please restart to enter new token.");
        } catch (e) {}
        process.exit(1);
    });
}

runBot();