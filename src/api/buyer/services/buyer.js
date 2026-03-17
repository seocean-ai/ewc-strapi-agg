'use strict';

/**
 * buyer service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::buyer.buyer');
