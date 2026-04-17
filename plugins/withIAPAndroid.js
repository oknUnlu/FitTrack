const { withAppBuildGradle, createRunOncePlugin } = require('expo/config-plugins');

const MISSING_DIMENSION_LINE = '        missingDimensionStrategy "store", "play"';

function modifyAppBuildGradle(contents) {
  if (contents.includes('missingDimensionStrategy "store", "play"')) {
    return contents;
  }
  const lines = contents.split('\n');
  const idx = lines.findIndex((line) => /defaultConfig\s*\{/.test(line));
  if (idx === -1) return contents;
  lines.splice(idx + 1, 0, MISSING_DIMENSION_LINE);
  return lines.join('\n');
}

const withIAPAndroid = (config) => {
  return withAppBuildGradle(config, (cfg) => {
    cfg.modResults.contents = modifyAppBuildGradle(cfg.modResults.contents);
    return cfg;
  });
};

module.exports = createRunOncePlugin(withIAPAndroid, 'withIAPAndroid', '1.0.0');
