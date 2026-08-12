import express from 'express';
import { getUsersDB, saveUsersDB, canManageAdmin, OWNER_DISCORD_ID } from './db.js';
import { getCharacterNameFromSheet, getRankFromSheet, getPermFromSheet } from './sheets.js';

const router = express.Router();

router.get('/requests', async (req, res) => {
    if (!req.isAuthenticated() || !canManageAdmin(req.user.id)) {
        return res.status(403).json({ error: 'غير مصرح لك' });
    }

    const db = getUsersDB();
    const currentUserId = req.user.id;

    let requests = await Promise.all(Object.keys(db).map(async (id) => {
        let sheetRpName = await getCharacterNameFromSheet(id);
        let sheetRank = await getRankFromSheet(id);
        let sheetPerm = await getPermFromSheet(id);
        const finalRpName = sheetRpName || db[id].rpName || db[id].username;
        const finalRank = sheetRank || db[id].rank || 'جندي';
        const finalPerm = sheetPerm !== undefined ? sheetPerm : (db[id].perm || '');

        return {
            id,
            username: db[id].username,
            rpName: finalRpName,
            avatar: db[id].avatar || null,
            status: db[id].status,
            rank: finalRank,
            perm: finalPerm
        };
    }));

    requests.sort((a, b) => {
        if (a.id === currentUserId) return -1;
        if (b.id === currentUserId) return 1;
        return 0;
    });

    res.json(requests);
});

router.post('/action', (req, res) => {
    if (!req.isAuthenticated() || !canManageAdmin(req.user.id)) {
        return res.status(403).json({ error: 'غير مصرح لك' });
    }

    const { userId, action, rank, perm } = req.body; 
    const currentUserId = req.user.id;
    const db = getUsersDB();

    if (userId === OWNER_DISCORD_ID && currentUserId !== OWNER_DISCORD_ID) {
        return res.status(403).json({ error: 'لا يمكنك تعديل صلاحيات أو رتبة الأونر' });
    }

    if (db[userId]) {
        db[userId].status = action;

        if (rank !== undefined && rank !== null) db[userId].rank = rank;
        if (perm !== undefined && perm !== null) db[userId].perm = perm;

        saveUsersDB(db);
        return res.json({ success: true });
    }

    res.status(404).json({ error: 'المستخدم غير موجود' });
});

export default router;