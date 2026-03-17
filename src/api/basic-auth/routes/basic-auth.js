'use strict';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/_auth',
      handler: 'basic-auth.check',
      config: {
        auth: false, // DO NOT protect this route
      },
    },
  ],
};
