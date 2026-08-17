import { MongoClient } from 'mongodb';

// اتصال واحد بس بقاعدة البيانات بيتعاد استخدامه في كل الطلبات
// (مش بنفتح اتصال جديد كل مرة - ده بيبطئ الموقع)
let clientPromise = null;

async function getClient() {
    if (!clientPromise) {
        const uri = process.env.MONGODB_URI;
        if (!uri) {
            throw new Error('لازم تحط رابط قاعدة البيانات في متغير البيئة MONGODB_URI (من MongoDB Atlas)');
        }
        const client = new MongoClient(uri);
        clientPromise = client.connect();
    }
    return clientPromise;
}

export async function getDb() {
    const client = await getClient();
    return client.db(process.env.MONGODB_DB_NAME || 'border_guard_system');
}

export async function getRecordsCollection() {
    const db = await getDb();
    return db.collection('records');
}

export async function getUsersCollection() {
    const db = await getDb();
    return db.collection('users');
}

export async function getDoorSessionsCollection() {
    const db = await getDb();
    return db.collection('door_sessions');
}
