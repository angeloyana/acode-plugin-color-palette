const path = require('path');
const { exec } = require('child_process');

module.exports = (env, argv) => {
  const { mode = 'development' } = argv;

  const rules = [
    {
      test: /\.m?js$/,
      use: ['html-tag-js/jsx/tag-loader', 'babel-loader']
    },
    {
      test: /\.(sa|sc|c)ss$/,
      use: ['raw-loader', 'postcss-loader', 'sass-loader']
    }
  ];

  const build = (compiler) => {
    compiler.hooks.afterDone.tap('zip', () => {
      exec('node .scripts/zip.js', (err, stdout) => {
        if (err) console.error(err);
        else console.log(stdout);
      });
    });
  };

  return {
    mode,
    entry: {
      main: path.resolve(__dirname, 'src', 'main.js')
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js',
      chunkFilename: '[name].js'
    },
    module: {
      rules
    },
    plugins: [
      {
        apply: build
      }
    ]
  };
};
