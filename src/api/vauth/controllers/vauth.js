'use strict';
const bcrypt = require('bcryptjs');

module.exports = {
  async check(ctx) {
    try {
      const authHeader = ctx.request.header.authorization;

      // No Authorization header → trigger popup
      if (!authHeader || !authHeader.startsWith('Basic ')) {
        ctx.status = 401;
        ctx.set('WWW-Authenticate', 'Basic realm="Authentication Required"');
        ctx.body = 'Unauthorized';
        return;
      }

      // Decode Base64 credentials
      const encoded = authHeader.split(' ')[1];
      const decoded = Buffer.from(encoded, 'base64').toString();
      const [username, password] = decoded.split(':');

      if (!username || !password) {
        ctx.status = 401;
        ctx.set('WWW-Authenticate', 'Basic realm="Authentication Required"');
        ctx.body = 'Unauthorized';
        return;
      }

      // Look up user in Strapi users-permissions
      const user = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { username },
        populate: ['role'],
      });

      if (!user) {
        ctx.status = 401;
        ctx.set('WWW-Authenticate', 'Basic realm="Authentication Required"');
        ctx.body = 'Unauthorized';
        return;
      }

      // Verify password
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        ctx.status = 401;
        ctx.set('WWW-Authenticate', 'Basic realm="Authentication Required"');
        ctx.body = 'Unauthorized';
        return;
      }

      // Auth OK → return headers for NGINX
      ctx.set('X-Auth-User', user.username);
      ctx.set('X-Auth-Role', user.role?.name || 'user');
      ctx.status = 200;
      ctx.body = 'OK';

    } catch (err) {
      ctx.status = 401;
      ctx.set('WWW-Authenticate', 'Basic realm="Authentication Required"');
      ctx.body = 'Unauthorized';
    }
  },
};
