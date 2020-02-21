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
import path from 'path';
import { createStaticServer } from './_server';
import { runWebpack } from './_util';
import { evaluatePage } from './_page';

jest.setTimeout(30000);

describe('Integration', () => {
  test('The resulting Worker is instantiated correctly', async () => {
    const fixture = 'basic';

    await runWebpack(fixture, {
      plugins: [new WorkerPlugin()]
    });

    const server = await createStaticServer(path.resolve(__dirname, 'fixtures', fixture));

    const consoleText = await evaluatePage(server.url, /page got data/g);

    expect(consoleText).toMatch(/page got data/g);

    await server.stop();
  });
  test('The SharedWorker is instantiated correctly', async () => {
    const fixture = 'shared';

    await runWebpack(fixture, {
      plugins: [new WorkerPlugin()]
    });

    const server = await createStaticServer(path.resolve(__dirname, 'fixtures', fixture));

    const consoleText = await evaluatePage(server.url, /page got data/g);

    expect(consoleText).toMatch(/page got data/g);

    await server.stop();
  });
});
