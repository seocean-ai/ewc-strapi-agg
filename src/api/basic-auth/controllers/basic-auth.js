'use strict';

const bcrypt = require('bcryptjs');

// Simple in-memory cache (replace with Redis in prod)
const cache = new Map();
const CACHE_TTL = 60 * 1000; // 60 seconds

module.exports = {
  async check(ctx) {
    const auth = ctx.request.header.authorization;

    if (!auth || !auth.startsWith('Basic ')) {
      ctx.status = 401;
      return;
    }

    let decoded;
    try {
      decoded = Buffer.from(auth.split(' ')[1], 'base64').toString();
    } catch {
      ctx.status = 401;
      return;
    }

    const [username, password] = decoded.split(':');

    if (!username || !password) {
      ctx.status = 401;
      return;
    }

    // Cache key = credentials hash
    const cacheKey = Buffer.from(`${username}:${password}`).toString('base64');
    const cachedUntil = cache.get(cacheKey);

    if (cachedUntil && cachedUntil > Date.now()) {
      ctx.status = 200;
      return;
    }

    const user = await strapi.db
      .query('plugin::users-permissions.user')
      .findOne({
        where: { username },
        populate: ['role'],
      });

    if (!user || !user.password) {
      ctx.status = 401;
      return;
    }

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      ctx.status = 401;
      return;
    }

    // Optional headers passed back to ingress
    ctx.set('X-Auth-User', user.username);
    ctx.set('X-Auth-Role', user.role?.name || 'user');

    cache.set(cacheKey, Date.now() + CACHE_TTL);
    ctx.status = 200;
  },
};
