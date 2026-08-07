'use strict';

// HTTP/SSE backend for the monitoring-tool client. Streams the latest
// UR10e + Kawasaki joint state from MongoDB Atlas over Server-Sent Events
// at /api/telemetry/joint-states/stream. For a one-off console dump of the
// same data, use debug.js instead.

require('dotenv').config();

const dns = require('node:dns');
dns.setServers(['1.1.1.1', '8.8.8.8']);

const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');

const PORT = Number(process.env.PORT || 3001);
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || 'ifarlabmatisse_db_user';
const COLLECTION_NAME = process.env.COLLECTION_NAME || 'joint_states';
const MIN_INTERVAL_MS = 250;
const DEFAULT_INTERVAL_MS = 1000;
const HEARTBEAT_MS = 15000;

if (!MONGODB_URI) {
  console.error('Error: MONGODB_URI is not defined in .env.');
  process.exit(1);
}

// Raw Mongo document stores ur10e/kawasaki as 7-element arrays: the first
// entry is the mobile/linear mount joint -- a prismatic (metres, not
// radians) axis that slides the whole arm/AGV along its rail -- followed by
// the 6 arm joints in order.
const RAD_TO_DEG = 180 / Math.PI;
const toArmDegrees = (values) => {
  if (!Array.isArray(values) || values.length < 7) return null;
  return values.slice(1, 7).map((rad) => Number(rad) * RAD_TO_DEG);
};
const toRailPosition = (values) => {
  if (!Array.isArray(values) || values.length < 1) return null;
  return Number(values[0]);
};

let client = null;
let collection = null;
let connecting = null;

async function ensureConnected() {
  if (collection) return collection;
  if (connecting) return connecting;

  connecting = (async () => {
    const mongoClient = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });
    await mongoClient.connect();
    client = mongoClient;
    collection = mongoClient.db(DB_NAME).collection(COLLECTION_NAME);
    console.log('MongoDB Atlas connection successful.');
    console.log(`Database   : ${DB_NAME}`);
    console.log(`Collection : ${COLLECTION_NAME}`);
    return collection;
  })().catch((error) => {
    console.error('MongoDB connection error:', error.message);
    client = null;
    collection = null;
    throw error;
  }).finally(() => {
    connecting = null;
  });

  return connecting;
}

async function getLatestDocument() {
  const col = await ensureConnected();
  const latestById = await col.findOne({ _id: 'latest' });
  if (latestById) return latestById;
  return col.find({}).sort({ ts: -1 }).limit(1).next();
}

// CORS_ORIGIN restricts the SSE/API endpoints to specific frontend origins in
// production (e.g. your Vercel domain(s), comma-separated). Left unset, it
// falls back to allowing any origin, which is fine for local dev but should
// be set once the client is actually deployed.
const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const app = express();
app.use(cors({ origin: allowedOrigins.length > 0 ? allowedOrigins : true }));

app.get('/api/health', async (req, res) => {
  res.json({ ok: true, mongoConnected: Boolean(collection) });
});

app.get('/api/telemetry/joint-states/stream', (req, res) => {
  const requested = Number(req.query.interval) || DEFAULT_INTERVAL_MS;
  const intervalMs = Math.max(MIN_INTERVAL_MS, requested);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  send('hello', { ok: true });

  let lastTs = null;

  const tick = async () => {
    try {
      const doc = await getLatestDocument();
      if (!doc) return;

      const ts = doc.ts ? new Date(doc.ts).getTime() : Date.now();
      if (ts === lastTs) return;

      const ur10e = toArmDegrees(doc.ur10e);
      const kawasaki = toArmDegrees(doc.kawasaki);
      if (!ur10e && !kawasaki) return;

      const ur10eRail = toRailPosition(doc.ur10e);
      const agvRail = toRailPosition(doc.kawasaki);

      lastTs = ts;
      send('joint_states', { timestamp: ts, ur10e, ur10eRail, kawasaki, agvRail });
    } catch (error) {
      // Transient Atlas/DNS hiccups shouldn't kill the stream -- just skip
      // this tick and retry on the next one.
      console.warn('Telemetry query error:', error.message);
    }
  };

  tick();
  const pollTimer = setInterval(tick, intervalMs);
  const heartbeatTimer = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS);

  req.on('close', () => {
    clearInterval(pollTimer);
    clearInterval(heartbeatTimer);
  });
});

app.listen(PORT, () => {
  console.log(`API listening: http://localhost:${PORT}`);
  ensureConnected().catch(() => {
    console.warn('Could not establish MongoDB connection at startup; will retry on each tick.');
  });
});

process.on('SIGINT', async () => {
  await client?.close().catch(() => {});
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await client?.close().catch(() => {});
  process.exit(0);
});
