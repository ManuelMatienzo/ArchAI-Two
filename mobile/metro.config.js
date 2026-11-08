const { getDefaultConfig } = require('@expo/metro-config');

const config = getDefaultConfig(__dirname);

// Evitar recargas constantes ("Refreshing...") causadas por cambios en archivos de configuración interna
config.resolver.blockList = [
  /.*\.git\/.*/,
  /.*\.expo\/.*/,
  /.*node_modules[/\\]\.cache\/.*/,
  /.*\.log$/,
];

module.exports = config;
