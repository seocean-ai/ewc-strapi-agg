'use strict';
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

module.exports = {
  async check(ctx) {
    try {
      const authHeader = ctx.request.header.authorization;
      const cookieHeader = ctx.request.header.cookie;
      const unauthorized = (reason) => {
        ctx.status = 401;
        ctx.set('WWW-Authenticate', 'Basic realm="Authentication Required"');
        if (reason) ctx.set('X-Vauth-Reason', reason);
        ctx.body = reason ? `Unauthorized:${reason}` : 'Unauthorized';
      };

      // No Authorization header → trigger popup
      if (!authHeader) {
        unauthorized('missing-authorization');
        return;
      }

      if (authHeader.startsWith('Basic ')) {
        // Decode Base64 credentials
        const encoded = authHeader.split(' ')[1];
        const decoded = Buffer.from(encoded, 'base64').toString();
        const [username, password] = decoded.split(':');

        if (!username || !password) {
          unauthorized('basic-malformed-credentials');
          return;
        }

        // Look up user in Strapi users-permissions
        const user = await strapi.db.query('plugin::users-permissions.user').findOne({
          where: { username },
          populate: ['role'],
        });

        if (!user) {
          unauthorized('basic-user-not-found');
          return;
        }

        // Verify password
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
          unauthorized('basic-password-invalid');
          return;
        }

        // Auth OK → return headers for NGINX
        ctx.set('X-Auth-User', user.username);
        ctx.set('X-Auth-Role', user.role?.name || 'user');
        ctx.status = 200;
        ctx.body = 'OK';
        return;
      }

      if(cookieHeader && cookieHeader.startsWith('strapi_admin_refresh=')) {
        const sessionId = cookieHeader.split('strapi_admin_refresh=')[1];
        if(sessionId) {
          authHeader = `Bearer ${sessionId}`;
          return;
        }
        //const session = await strapi.db.query('admin::session').findOne({
        //  where: { sessionId },
        //});
        //if (!session) {
        //  unauthorized('admin-session-not-found');
        //  return;
        //}
      }

      if (authHeader.startsWith('Bearer ')) {
        const encodedCredentials = authHeader.split(' ')[1];

        // Bearer token is a JWT: header.payload.signature
        // We verify signature, decode payload to extract sessionId/userId,
        // then validate them against Strapi's stored sessions.
        const jwtParts = encodedCredentials.split('.');
        if (jwtParts.length !== 3) {
          unauthorized('jwt-not-3-parts');
          return;
        }

        const decodeBase64Url = (str) => {
          // base64url -> base64
          const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
          const padding = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4));
          return Buffer.from(base64 + padding, 'base64').toString('utf8');
        };

        const decodeBase64UrlToBuffer = (str) => {
          const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
          const padding = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4));
          return Buffer.from(base64 + padding, 'base64');
        };

        // Verify JWT signature (HS256) using Strapi admin auth secret
        // If the secret is missing, we fail closed (401).
        const secret =
          (typeof strapi?.config?.get === 'function' ? strapi.config.get('admin.auth.secret') : undefined) ||
          process.env.ADMIN_JWT_SECRET;
        if (!secret) {
          unauthorized('jwt-secret-missing');
          return;
        }

        try {
          const headerJson = decodeBase64Url(jwtParts[0]);
          const jwtHeader = JSON.parse(headerJson);
          if (jwtHeader?.alg !== 'HS256') {
            unauthorized('jwt-unsupported-alg');
            return;
          }

          const actualSignatureBase64Url = jwtParts[2];
          const actualSignatureBytes = decodeBase64UrlToBuffer(actualSignatureBase64Url);

          const dataToSign = `${jwtParts[0]}.${jwtParts[1]}`;
          const expectedSignatureBytes = crypto
            .createHmac('sha256', String(secret))
            .update(dataToSign)
            .digest();

          if (
            actualSignatureBytes.length !== expectedSignatureBytes.length ||
            !crypto.timingSafeEqual(actualSignatureBytes, expectedSignatureBytes)
          ) {
            unauthorized('jwt-signature-invalid');
            return;
          }
        } catch {
          unauthorized('jwt-header-parse-failed');
          return;
        }

        let jwtPayload;
        try {
          const payloadJson = decodeBase64Url(jwtParts[1]);
          jwtPayload = JSON.parse(payloadJson);
        } catch {
          unauthorized('jwt-payload-parse-failed');
          return;
        }

        if (!jwtPayload || !jwtPayload.sessionId || !jwtPayload.userId) {
          unauthorized('jwt-missing-claims');
          return;
        }

        // Note: we don't strictly enforce jwtPayload.exp.
        // The authoritative validity check is whether the corresponding Strapi
        // session exists in `admin::session` (and optionally `session.expiresAt` below).

        const sessionId = String(jwtPayload.sessionId);
        // admin::session.userId is stored as a string
        const adminUserId = String(jwtPayload.userId);
        // plugin::users-permissions.user.id is typically numeric; coerce when safe
        const userId =
          typeof jwtPayload.userId === 'string' && /^\d+$/.test(jwtPayload.userId)
            ? Number(jwtPayload.userId)
            : jwtPayload.userId;

        // Validate that the session exists (Strapi session manager storage)
        const session = await strapi.db.query('admin::session').findOne({
          where: { sessionId, userId: adminUserId },
        });

        if (!session) {
          unauthorized('admin-session-not-found');
          return;
        }

        // Optional expiry check if Strapi returns expiresAt
        /*
        if (session.expiresAt) {
          const expiresAtMs = new Date(session.expiresAt).getTime();
          if (!Number.isNaN(expiresAtMs) && expiresAtMs <= Date.now()) {
            unauthorized('admin-session-expired');
            return;
          }
        }
        */
        // Look up the user and return NGINX headers
        const user = await strapi.db
          .query('plugin::users-permissions.user')
          .findOne({
            where: { id: userId },
            populate: ['role'],
          });

        if (!user) {
          unauthorized('jwt-user-not-found');
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
      return;

    } catch (err) {
      ctx.status = 401;
      ctx.set('WWW-Authenticate', 'Basic realm="Authentication Required"');
      ctx.body = 'Unauthorized';
    }
  },
};
