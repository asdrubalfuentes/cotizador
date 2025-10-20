const test = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Forzar selección de repo mongo
process.env.REPO_BACKEND = 'mongo';

const { connect, close } = require('../lib/db/mongo');
const { getRepo } = require('../lib/repo');

test('repo.mongo: save and read a quote', async () => {
	const mongod = await MongoMemoryServer.create();
	const uri = mongod.getUri();
	await connect(uri, 'cotizador_test');

	const repo = getRepo();
	const ref = repo.nextRef('COTTEST');
	const file = `${ref}.json`;
	const payload = {
		quoteNumber: ref,
		client: 'Cliente Test',
		clientEmail: 'test@example.com',
		total: 12345,
		saved_at: new Date().toISOString(),
	};
	await repo.saveJSON(file, payload);
	const got = await repo.readJSON(file);
	assert.ok(got, 'should read back doc');
	assert.equal(got.quoteNumber, ref);
	assert.equal(got.client, payload.client);
	assert.equal(got.total, payload.total);

	const list = await repo.listQuotes();
	assert.ok(Array.isArray(list));
	assert.ok(list.some(x => x.file === file));

	await close();
	await mongod.stop();
});
