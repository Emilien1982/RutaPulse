const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// Map glyph files (ADR 0013, section 2).
config.resolver.assetExts.push('pbf');

module.exports = config;
