/**
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */

import WorkerPlugin from '../src';
import server from './_server';
import { runWebpack } from './_util';
import { getConsolePage } from './_page';

describe('worker-plugin', () => {
  test("it uses the Worker's in browser", async () => {
    const fixture = 'basic';

    await runWebpack(fixture, {
      plugins: [new WorkerPlugin()]
    });

    await server.start({
      fixture
    });

    const consoleText = await getConsolePage('http://localhost:3000');

    expect(consoleText).toMatch(/page got data/g);

    server.stop();
  });
});
