// Compile the real app without loading dotenv or production Firebase settings.
process.env.NODE_ENV = 'development';
process.env.BABEL_ENV = 'development';
const path = require('node:path');
const webpack = require('webpack');
const root = path.resolve(__dirname, '../..');
const compiler = webpack({
  mode: 'development', devtool: false, context: root,
  cache: { type: 'filesystem', cacheDirectory: path.join(root, 'node_modules/.cache/client-workflow-qa-webpack') },
  entry: path.join(root, 'src/index.tsx'),
  output: { path: path.join(root, 'artifacts/client-workflow-qa/app'), filename: '[name].js', publicPath: '/', clean: false },
  resolve: { extensions: ['.tsx', '.ts', '.js', '.mjs', '.json'], fallback: { fs: false, path: false, crypto: false } },
  module: { rules: [
    { test: /\.[jt]sx?$/, exclude: /node_modules/, use: { loader: require.resolve('babel-loader'), options: { babelrc: false, configFile: false, presets: [[require.resolve('babel-preset-react-app'), { runtime: 'automatic' }]] } } },
    { test: /\.css$/, use: [require.resolve('style-loader'), require.resolve('css-loader'), { loader: require.resolve('postcss-loader'), options: { postcssOptions: { plugins: [require('tailwindcss')({ content: [path.join(root, 'src/**/*.{ts,tsx}')], theme: require(path.join(root, 'tailwind.config.js')).theme }), require('autoprefixer')] } } }] },
    { test: /\.svg$/, use: [require.resolve('@svgr/webpack'), require.resolve('file-loader')] },
    { test: /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|otf|pdf)$/, type: 'asset/resource' },
  ] },
  plugins: [
    new webpack.DefinePlugin({ 'process.env': Object.fromEntries(Object.entries({ NODE_ENV: 'development', PUBLIC_URL: '', REACT_APP_TEAM_ACCOUNT_APPROVALS_ENABLED: 'true', REACT_APP_FIREBASE_PROJECT_ID: 'demo-client-workflow', REACT_APP_DEPLOYMENT_ENV: 'qa' }).map(([key, value]) => [key, JSON.stringify(value)])) }),
    new webpack.NormalModuleReplacementPlugin(/config[\\/]firebase(?:Base|Auth)?$/, path.join(__dirname, 'firebase.ts')),
  ],
  optimization: { splitChunks: { chunks: 'all' } },
});
compiler.run((error, stats) => {
  compiler.close(() => {});
  if (error || stats.hasErrors()) { console.error(error || stats.toString({ all: false, errors: true })); process.exitCode = 1; return; }
  const fs = require('node:fs');
  const entry = stats.toJson({ all: false, entrypoints: true }).entrypoints.main.assets.filter(asset => asset.name.endsWith('.js')).map(asset => asset.name);
  fs.writeFileSync(path.join(root, 'artifacts/client-workflow-qa/app/entry.json'), JSON.stringify(entry));
  console.log('Local-only full application built.');
});
