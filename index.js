/**
 * PROJECT: Voicecord (Node.js Edition) - SMART RAM CLEANER
 * TARGET: High Population Servers (1000+ users in voice)
 */

const fs = require("fs");
const readline = require("readline");
const { Client, Options } = require("discord.js-selfbot-v13");
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  StreamType,
  NoSubscriberBehavior,
} = require("@discordjs/voice");
const { Readable } = require("stream");

const SILENCE_FRAME = Buffer.from([0xf8, 0xff, 0xfe]);
class Silence extends Readable {
  _read() {
    this.push(SILENCE_FRAME);
  }
}

const ask = (q) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((r) =>
    rl.question(q, (a) => {
      rl.close();
      r(a.trim());
    })
  );
};

async function setup() {
  if (fs.existsSync("./.env")) {
    require("dotenv").config();
    return;
  }
  console.log("--- SETUP ---");
  const t = await ask("User Token: ");
  const g = await ask("Guild ID: ");
  const c = await ask("Channel ID: ");
  fs.writeFileSync("./.env", `TOKEN=${t}\nGUILD_ID=${g}\nCHANNEL_ID=${c}`);
  require("dotenv").config();
}

async function run() {
  await setup();

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

    sweepers: {
      voiceStates: {
        interval: 60,
        filter: () => (voiceState, id) => {
          if (client.user && id === client.user.id) return false;

          return true;
        },
      },
    },
  });

  let connection = null;
  let player = null;
  let isReconnecting = false;

  function playSilence() {
    if (!player) return;
    const r = createAudioResource(new Silence(), {
      inputType: StreamType.Opus,
    });
    player.play(r);
  }

  async function connect() {
    if (isReconnecting) return;
    isReconnecting = true;

    const guild = client.guilds.cache.get(process.env.GUILD_ID);

    let channel = guild?.channels.cache.get(process.env.CHANNEL_ID);
    if (!channel) {
      try {
        channel = await client.channels.fetch(process.env.CHANNEL_ID);
      } catch {
        console.error("[ERR] Kênh không tìm thấy. Thử lại sau 10s...");
        isReconnecting = false;
        return setTimeout(connect, 10000);
      }
    }

    try {
      if (connection) {
        connection.removeAllListeners();
        connection.destroy();
      }
    } catch {}

    console.log(`[NET] Đang kết nối vào: ${channel.name}...`);

    try {
      connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: true,
      });

      player = createAudioPlayer({
        behaviors: { noSubscriber: NoSubscriberBehavior.Play },
      });

      player.on(AudioPlayerStatus.Idle, () => {
        if (connection?.state.status !== VoiceConnectionStatus.Destroyed)
          playSilence();
      });
      player.on("error", () => setTimeout(playSilence, 1000));

      playSilence();
      connection.subscribe(player);

      console.log("[OK] Đã vào kênh (Smart Cache Mode).");
      isReconnecting = false;

      connection.on(VoiceConnectionStatus.Disconnected, async () => {
        console.warn("[WARN] Rớt mạng. Đang chờ...");
        try {
          await Promise.race([
            entersState(connection, VoiceConnectionStatus.Signalling, 120_000),
            entersState(connection, VoiceConnectionStatus.Connecting, 120_000),
          ]);
          console.log("[INFO] Mạng đã có lại.");
        } catch {
          console.warn("[WARN] Timeout 2 phút. Re-connecting...");
          if (connection) connection.destroy();
          isReconnecting = false;
          setTimeout(connect, 2000);
        }
      });
    } catch (e) {
      console.error(`[ERR] Lỗi Join: ${e.message}`);
      isReconnecting = false;
      setTimeout(connect, 10000);
    }
  }

  client.on("ready", () => {
    console.log(`[SYS] Đã đăng nhập: ${client.user.tag}`);
    connect();

    setInterval(() => {
      if (isReconnecting) return;

      const me = client.guilds.cache.get(process.env.GUILD_ID)?.members?.me;

      if (
        !me?.voice?.channelId ||
        me.voice.channelId !== process.env.CHANNEL_ID
      ) {
        console.log(
          "[WATCHDOG] Phát hiện bot không trong kênh. Re-connecting..."
        );
        connect();
      }
    }, 60000);
  });

  client.login(process.env.TOKEN).catch(() => {
    console.error("[FATAL] Token lỗi.");
    process.exit(1);
  });
}

process.on("unhandledRejection", (e) => {});
process.on("uncaughtException", (e) => {});

run();
