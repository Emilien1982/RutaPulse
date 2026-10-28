// Android accent color (buttons of native dialogs): brown instead of the
// default teal of the theme. Applied when the native project is generated.
const { withAndroidStyles } = require('expo/config-plugins');

const BROWN = '#3A1F0F';

module.exports = function withAndroidAccent(config) {
  return withAndroidStyles(config, (config) => {
    const theme = config.modResults.resources.style?.find(
      (style) => style.$.name === 'AppTheme',
    );
    if (theme) {
      theme.item = (theme.item ?? []).filter((i) => i.$.name !== 'colorAccent');
      theme.item.push({ $: { name: 'colorAccent' }, _: BROWN });
    }
    return config;
  });
};
