<p align="center">
  <img src="https://i.imgur.com/MlrAQjl.jpg" width="1000" alt="worker-plugin">
</p>
<h1 align="center">👩‍🏭 threads-plugin</h1>
<p align="center">Automatically bundle & compile <a href="https://github.com/andywer/threads.js">threads.js</a> workers within webpack.</p>

### Fork of [`GoogleChromeLabs/worker-plugin`](https://github.com/GoogleChromeLabs/worker-plugin)

This is an adapted version of the original `worker-plugin` that supports `Worker` constructors imported from [`threads`](https://github.com/andywer/threads.js).

### Features

Automatically compiles modules loaded in Web Workers:

```js
const worker = new Worker('./foo.js', { type: 'module' });
                          ^^^^^^^^^^
                          gets bundled using webpack
```

The best part? That worker constructor works just fine without bundling turned on too.

Workers created from Blob & data URLs or without the `{ type:'module' }` option are left unchanged.

## Installation

```sh
npm install -D threads-plugin
```

Then drop it into your **webpack.config.js:**

```diff
+ const ThreadsPlugin = require('threads-plugin');

module.exports = {
  <...>
  plugins: [
+    new ThreadsPlugin()
  ]
  <...>
}
```

## Usage

**worker.js**: _(our worker module)_

```js
// This is a module worker, so we can use imports (in the browser too!)
import { expose } from 'threads';
import { calculatePi } from './some-other-module';

expose(function piTimesTwo(precision) {
  return calculatePi(precision) * 2
})
```

**main.js**: _(our demo, on the main thread)_

```js
import { spawn, Worker } from 'threads';

main().catch(console.error)

async function main() {
  const piTimesTwo = await spawn(new Worker('./worker.js'))
  console.log(`pi x 2 = ${await piTimesTwo(42)}`)
}
```

## Options

In most cases, no options are necessary to use WorkerPlugin.

### `globalObject`

ThreadsPlugin will warn you if your Webpack configuration has `output.globalObject` set to `window`, since doing so breaks Hot Module Replacement in web workers.

If you're not using HMR and want to disable this warning, pass `globalObject:false`:

```js
new ThreadsPlugin({
  // disable warnings about "window" breaking HMR:
  globalObject: false
})
```

To configure the value of `output.globalObject` for ThreadsPlugin's internal Webpack Compiler, set `globalObject` to any String:

```js
new ThreadsPlugin({
  // use "self" as the global object when receiving hot updates.
  globalObject: 'self' // <-- this is the default value
})
```

### `plugins`

By default, `ThreadsPlugin` doesn't run any of your configured Webpack plugins when bundling worker code - this avoids running things like `html-webpack-plugin` twice. For cases where it's necessary to apply a plugin to Worker code, use the `plugins` option.

Here you can specify the names of plugins to "copy" from your existing Webpack configuration, or provide specific plugins to apply only to worker code:

```js
module.exports = {
  <...>
  plugins: [
    // an example of a plugin already being used:
    new SomeExistingPlugin({ <...> }),

    new ThreadsPlugin({
      plugins: [
        // A string here will copy the named plugin from your configuration:
        'SomeExistingPlugin',
        
        // Or you can specify a plugin directly, only applied to Worker code:
        new SomePluginToApplyOnlyToWorkers({ <...> })
      ]
    })
  ]
  <...>
}
```

## License

Apache-2.0
