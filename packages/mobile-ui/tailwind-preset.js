const { tokens } = require('./src/theme/tokens');
module.exports = {
  theme: {
    extend: {
      colors: {
        canvas: tokens.color.canvas,
        surface: tokens.color.surface,
        line: tokens.color.border,
        ink: tokens.color.ink,
        muted: tokens.color.muted,
        kiwi: tokens.color.kiwi,
        lime: tokens.color.lime,
        emerald: tokens.color.emerald,
        amber: tokens.color.amber,
        sinpe: tokens.color.sinpe,
        danger: tokens.color.danger,
      },
    },
  },
};
