'use strict';

// CLI debug tool: polls MongoDB directly and prints the latest joint-state
// document to the console. Does not serve HTTP -- for that, run server.js.

require('dotenv').config();

const dns = require("node:dns");
dns.setServers(["1.1.1.1", "8.8.8.8"]);
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
const databaseName = process.env.DB_NAME || 'ifarlabmatisse_db_user';
const collectionName = process.env.COLLECTION_NAME || 'joint_states';
const pollIntervalMs = Number(process.env.POLL_INTERVAL_MS || 1000);
const runOnce = process.argv.includes('--once');

const ur10eJointNames = [
  'ur10e_base_to_robot_mount',
  'ur10e_shoulder_pan_joint',
  'ur10e_shoulder_lift_joint',
  'ur10e_elbow_joint',
  'ur10e_wrist_1_joint',
  'ur10e_wrist_2_joint',
  'ur10e_wrist_3_joint',
];

const kawasakiJointNames = [
  'world_to_agv',
  'joint1',
  'joint2',
  'joint3',
  'joint4',
  'joint5',
  'joint6',
];

if (!uri) {
  console.error('Error: MONGODB_URI is not defined in .env.');
  process.exit(1);
}

if (uri.includes('<NEW_ATLAS_PASSWORD>')) {
  console.error('Error: replace the <NEW_ATLAS_PASSWORD> placeholder in .env with your real Atlas password.');
  process.exit(1);
}

if (!Number.isFinite(pollIntervalMs) || pollIntervalMs < 250) {
  console.error('Error: POLL_INTERVAL_MS must be a number of at least 250.');
  process.exit(1);
}

const client = new MongoClient(uri, {
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
});

let stopping = false;
let lastFingerprint = null;

function mapJoints(names, values) {
  if (!Array.isArray(values)) return null;
  return Object.fromEntries(names.map((name, index) => [name, values[index] ?? null]));
}

function printDocument(doc) {
  const output = {
    _id: doc._id,
    ts: doc.ts,
    ur10e: mapJoints(ur10eJointNames, doc.ur10e),
    kawasaki: mapJoints(kawasakiJointNames, doc.kawasaki),
  };

  console.log(`\n--- Latest record (${new Date().toLocaleString('en-US')}) ---`);
  console.dir(output, { depth: null, colors: true });

  if (!Array.isArray(doc.ur10e) || doc.ur10e.length !== 7) {
    console.warn(`Warning: expected 7 values in the ur10e array; got: ${doc.ur10e?.length ?? 0}`);
  }
  if (!Array.isArray(doc.kawasaki) || doc.kawasaki.length !== 7) {
    console.warn(`Warning: expected 7 values in the kawasaki array; got: ${doc.kawasaki?.length ?? 0}`);
  }
}

async function getLatestDocument(collection) {
  const latestById = await collection.findOne({ _id: 'latest' });
  if (latestById) return latestById;
  return collection.find({}).sort({ ts: -1 }).limit(1).next();
}

async function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  await client.close().catch(() => {});
  console.log('\nMongoDB connection closed.');
  process.exit(exitCode);
}

async function main() {
  try {
    await client.connect();

    const database = client.db(databaseName);
    const collection = database.collection(collectionName);
    await database.command({ ping: 1 });

    const count = await collection.countDocuments({});
    console.log('MongoDB Atlas connection successful.');
    console.log(`Database   : ${databaseName}`);
    console.log(`Collection : ${collectionName}`);
    console.log(`Document count: ${count}`);

    do {
      const doc = await getLatestDocument(collection);

      if (!doc) {
        console.log('No documents in the collection yet.');
      } else {
        const fingerprint = `${String(doc._id)}:${new Date(doc.ts).getTime()}:${JSON.stringify(doc.ur10e)}:${JSON.stringify(doc.kawasaki)}`;
        if (fingerprint !== lastFingerprint) {
          lastFingerprint = fingerprint;
          printDocument(doc);
        }
      }

      if (!runOnce) {
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      }
    } while (!runOnce && !stopping);

    await stop(0);
  } catch (error) {
    console.error('\nMongoDB connection/query error:');
    console.error(error.message);
    console.error('\nCheck: Atlas Network Access IP list, username/password, and URI.');
    await stop(1);
  }
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));

main();
