import { BasePlatform } from './BasePlatform.js';

/**
 * definePlatform - Platform Plugin Helper
 * 
 * @param {Object} config - Platform configuration object
 * @returns {BasePlatform} Complete platform configuration as a BasePlatform instance
 */
export function definePlatform(config) {
  if (!config.id) throw new Error('Platform plugin must have an "id" property.');
  if (!config.name) throw new Error('Platform plugin must have a "name" property.');
  if (!config.detect) throw new Error('Platform plugin must have a "detect" method.');
  if (!config.commonExtensions || config.commonExtensions.length === 0) {
    throw new Error('Platform plugin must have at least one entry in "commonExtensions".');
  }

  return new BasePlatform(config);
}
