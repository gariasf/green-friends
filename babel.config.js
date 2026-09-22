module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Inlines the generated SQL migration files as strings (see drizzle/migrations.js).
    plugins: [['inline-import', { extensions: ['.sql'] }]],
  };
};
