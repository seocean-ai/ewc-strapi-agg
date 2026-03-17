'use strict';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/vauth',
      handler: 'vauth.check',
      config: {
        auth: false, // DO NOT protect this route
      },
    },
  ],
};
