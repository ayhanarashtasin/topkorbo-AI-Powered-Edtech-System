const { createClient } = require('redis');
const { RedisStore } = require('rate-limit-redis');
const { createAdapter } = require('@socket.io/redis-adapter');

const redisUrl = String(process.env.REDIS_URL || '').trim();
let rateLimitClient = null;
let rateLimitConnectPromise = null;

function isRedisEnabled() {
  return Boolean(redisUrl);
}

function connectClient(client, label) {
  client.on('error', (error) => {
    console.error(`${label} Redis error:`, error.message);
  });
  return client.connect();
}

function getRateLimitClient() {
  if (!redisUrl) return null;
  if (!rateLimitClient) {
    rateLimitClient = createClient({ url: redisUrl });
    rateLimitConnectPromise = connectClient(rateLimitClient, 'Rate limit').catch((error) => {
      console.error('Could not connect the distributed rate-limit store:', error.message);
      throw error;
    });
  }
  return rateLimitClient;
}

function createRateLimitStore(prefix) {
  const client = getRateLimitClient();
  if (!client) return null;

  return new RedisStore({
    prefix,
    sendCommand: (...args) => client.sendCommand(args)
  });
}

async function configureSocketAdapter(io) {
  if (!redisUrl) return false;

  const publisher = createClient({ url: redisUrl });
  const subscriber = publisher.duplicate();
  await Promise.all([
    connectClient(publisher, 'Socket publisher'),
    connectClient(subscriber, 'Socket subscriber'),
    rateLimitConnectPromise
  ]);
  io.adapter(createAdapter(publisher, subscriber));
  return true;
}

module.exports = {
  isRedisEnabled,
  createRateLimitStore,
  configureSocketAdapter
};
