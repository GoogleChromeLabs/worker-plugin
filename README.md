<p align="center">
  <img src="https://i.imgur.com/MlrAQjl.jpg" width="1000" alt="worker-plugin">
</p>
<h1 align="center">👩‍🏭 worker-plugin</h1>
<p align="center">Automatically bundle & compile Web Workers within Webpack.</p>


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
npm install -D worker-plugin
```

Then drop it into your **webpack.config.js:**

```diff
+ const WorkerPlugin = require('worker-plugin');

module.exports = {
  <...>
  plugins: [
  +    new WorkerPlugin()
  ]
  <...>
}
```

## Usage

**worker.js**: _(our worker module)_

```js
// This is a module worker, so we can use imports (in the browser too!)
import { calculatePi } from './some-other-module';

addEventListener('message', event => {
  postMessage(calculatePi(event.data));
});
```

**main.js**: _(our demo, on the main thread)_

```js
const piWorker = new Worker('./worker.js', { type: 'module' });
piWorker.onmessage = event => {
  console.log('pi: ' + event.data);
};
piWorker.postMessage(42);
```

## License

Apache-2.0
