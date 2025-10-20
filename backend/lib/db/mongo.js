const { MongoClient } = require('mongodb');

let client = null;
let db = null;

async function connect(uri, dbName) {
	if (db) return db;
	const mongoUri = uri || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
	const databaseName = dbName || process.env.MONGO_DB || 'cotizador';
	client = new MongoClient(mongoUri, { connectTimeoutMS: 5000 });
	await client.connect();
	db = client.db(databaseName);
	await ensureIndexes(db);
	return db;
}

async function ensureIndexes(db) {
	const col = db.collection('quotes');
	try { await col.createIndex({ quoteNumber: 1 }, { unique: true }); } catch (e) { console.warn('[mongo] index quoteNumber failed', e?.message || e); }
	try { await col.createIndex({ clientEmail: 1 }); } catch (e) { console.warn('[mongo] index clientEmail failed', e?.message || e); }
	try { await col.createIndex({ saved_at: -1 }); } catch (e) { console.warn('[mongo] index saved_at failed', e?.message || e); }
}

function getDbSync() {
	if (!db) throw new Error('Mongo not connected');
	return db;
}

async function getQuotesCollection() {
	if (!db) await connect();
	return db.collection('quotes');
}

async function close() {
	try { if (client) await client.close(); } catch (e) { console.warn('[mongo] close failed', e?.message || e); }
	client = null; db = null;
}

module.exports = { connect, getDbSync, getQuotesCollection, close };

