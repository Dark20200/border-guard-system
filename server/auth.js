import { Strategy as DiscordStrategy } from 'passport-discord';
import { getUsersDB, saveUsersDB, OWNER_DISCORD_ID } from './db.js';
import { getCharacterNameFromSheet, getRankFromSheet, getPermFromSheet } from './sheets.js';

export function setupAuth(passport) {
    passport.use(new DiscordStrategy({
        clientID: process.env.DISCORD_CLIENT_ID,
        clientSecret: process.env.DISCORD_CLIENT_SECRET,
        callbackURL: process.env.DISCORD_CALLBACK_URL || 'http://localhost:3000/auth/discord/callback',
        scope: ['identify', 'guilds'],
        passReqToCallback: true
    }, async (req, accessToken, refreshToken, profile, done) => {
        const db = await getUsersDB();
        const characterName = await getCharacterNameFromSheet(profile.id);
        const sheetRank = await getRankFromSheet(profile.id); 
        const sheetPerm = await getPermFromSheet(profile.id); 

        if (profile.id === OWNER_DISCORD_ID) {
            const userData = {
                username: profile.username,
                rpName: characterName || profile.username,
                avatar: profile.avatar || null,
                discriminator: profile.discriminator || '0'
            };
            if (!db[profile.id]) {
                db[profile.id] = { ...userData, status: 'approved', rank: sheetRank || 'قائد حرس الحدود', perm: sheetPerm || 'قاضي عسكري' };
            } else {
                db[profile.id].status = 'approved';
                db[profile.id].username = userData.username;
                db[profile.id].rpName = userData.rpName;
                db[profile.id].avatar = userData.avatar;
                db[profile.id].rank = sheetRank || 'قائد حرس الحدود';
                db[profile.id].perm = sheetPerm !== undefined ? sheetPerm : (db[profile.id].perm || 'قاضي عسكري');
            }
            await saveUsersDB(db);
            return done(null, profile);
        }

        if (!characterName) {
            return done(null, false);
        }

        const userData = {
            username: profile.username,
            rpName: characterName,
            avatar: profile.avatar || null,
            discriminator: profile.discriminator || '0'
        };

        if (!db[profile.id]) {
            db[profile.id] = { ...userData, status: 'approved', rank: sheetRank || 'جندي', perm: sheetPerm || '' }; 
        } else {
            db[profile.id].username = userData.username;
            db[profile.id].rpName = characterName;
            db[profile.id].avatar = userData.avatar;
            db[profile.id].rank = sheetRank || db[profile.id].rank || 'جندي'; 
            db[profile.id].perm = sheetPerm !== undefined ? sheetPerm : (db[profile.id].perm || '');
            if (db[profile.id].status !== 'approved') {
                db[profile.id].status = 'approved';
            }
        }
        await saveUsersDB(db);

        return done(null, profile);
    }));

    passport.serializeUser((user, done) => done(null, user));
    passport.deserializeUser((obj, done) => done(null, obj));
}