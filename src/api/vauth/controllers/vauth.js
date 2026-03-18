'use strict';
const bcrypt = require('bcryptjs');

module.exports = {
  async check(ctx) {
    try {
      const authHeader = ctx.request.header.authorization;
      const unauthorized = () => {
        ctx.status = 401;
        ctx.set('WWW-Authenticate', 'Basic realm="Authentication Required"');
        ctx.body = 'Unauthorized';
      };

      // No Authorization header → trigger popup
      if (!authHeader) {
        unauthorized();
        return;
      }

      if (authHeader.startsWith('Basic ')) {
        // Decode Base64 credentials
        const encoded = authHeader.split(' ')[1];
        const decoded = Buffer.from(encoded, 'base64').toString();
        const [username, password] = decoded.split(':');

        if (!username || !password) {
          unauthorized();
          return;
        }

        // Look up user in Strapi users-permissions
        const user = await strapi.db.query('plugin::users-permissions.user').findOne({
          where: { username },
          populate: ['role'],
        });

        if (!user) {
          unauthorized();
          return;
        }

        // Verify password
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
          unauthorized();
          return;
        }

        // Auth OK → return headers for NGINX
        ctx.set('X-Auth-User', user.username);
        ctx.set('X-Auth-Role', user.role?.name || 'user');
        ctx.status = 200;
        ctx.body = 'OK';
        return;
      }

      if (authHeader.startsWith('Bearer ')) {
        const encodedCredentials = authHeader.split(' ')[1];

        // Compatibility: treat Bearer token as base64("username:password")
        const decoded = Buffer.from(encodedCredentials, 'base64').toString();
        const [username, password] = decoded.split(':');

        if (!username || !password) {
          unauthorized();
          return;
        }

        // Look up user in Strapi users-permissions
        const user = await strapi.db.query('plugin::users-permissions.user').findOne({
          where: { username },
          populate: ['role'],
        });

        if (!user) {
          unauthorized();
          return;
        }

        // Verify password
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
          unauthorized();
          return;
        }

        // Auth OK → return headers for NGINX
        ctx.set('X-Auth-User', user.username);
        ctx.set('X-Auth-Role', user.role?.name || 'user');
        ctx.status = 200;
        ctx.body = 'OK';
        return;
      }

      unauthorized();

    } catch (err) {
      ctx.status = 401;
      ctx.set('WWW-Authenticate', 'Basic realm="Authentication Required"');
      ctx.body = 'Unauthorized';
    }
  },
};
