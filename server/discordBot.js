import { Client, GatewayIntentBits } from 'discord.js';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages
    ]
});

client.once('ready', () => {
    console.log(`🤖 بوت ديسكور التنبيهات يعمل بنجاح كـ: ${client.user.tag}`);
});

// تسجيل الدخول باستخدام التوكن من ملف .env
if (process.env.DISCORD_BOT_TOKEN) {
    client.login(process.env.DISCORD_BOT_TOKEN);
} else {
    console.warn("⚠️ تنبيه: DISCORD_BOT_TOKEN غير موجود في ملف البيئة.");
}

/**
 * @param {string} errorMessage 
 */
export async function sendPrivateAlert(errorMessage) {
    const ownerId = process.env.OWNER_DISCORD_ID;
    if (!ownerId) {
        console.warn("⚠️ تنبيه: OWNER_DISCORD_ID غير مرجّح في ملف البيئة.");
        return;
    }

    try {
        const owner = await client.users.fetch(ownerId);
        if (owner) {
            await owner.send(`🚨 **تنبيه خطأ من السيرفر:**\n\`\`\`${errorMessage}\`\`\``);
        }
    } catch (err) {
        console.error('❌ فشل إرسال التنبيه الخاص عبر ديسكور:', err);
    }
}