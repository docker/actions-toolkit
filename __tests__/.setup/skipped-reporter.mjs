/**
 * Copyright 2026 actions-toolkit authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import fs from 'node:fs';
import path from 'node:path';

export const vitestAllSkippedReporter = () => {
  let vitest;
  let hasExecutedTest;
  let hasAnyCollectedTest;

  const getFlagPath = () => {
    const reportsDirectory = vitest?.config?.coverage?.reportsDirectory ?? 'coverage';
    return path.join(reportsDirectory, 'allSkipped.txt');
  };

  return {
    onInit(ctx) {
      vitest = ctx;
      hasExecutedTest = false;
      hasAnyCollectedTest = false;
    },
    onTestCaseReady() {
      hasAnyCollectedTest = true;
    },
    onTestCaseResult(testCase) {
      const state = testCase.result()?.state;
      if (state === 'passed' || state === 'failed') {
        hasExecutedTest = true;
      }
    },
    onTestRunEnd() {
      if (!vitest?.config?.coverage?.enabled) {
        return;
      }
      const allSkipped = hasAnyCollectedTest && !hasExecutedTest;
      const flagPath = getFlagPath();
      if (allSkipped) {
        fs.mkdirSync(path.dirname(flagPath), {recursive: true});
        fs.writeFileSync(flagPath, '');
      } else if (fs.existsSync(flagPath)) {
        fs.rmSync(flagPath);
      }
    }
  };
};
