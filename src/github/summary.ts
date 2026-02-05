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

import he from 'he';
import {dump as yamldump} from 'js-yaml';
import os from 'os';
import * as core from '@actions/core';

import {GitHub} from './github';
import {Util} from '../util.js';

import {BuildSummaryOpts, SummaryTableCell} from '../types/github/summary.js';

export class GitHubSummary {
  public static async writeBuildSummary(opts: BuildSummaryOpts): Promise<void> {
    // can't use original core.summary.addLink due to the need to make
    // EOL optional
    const addLink = function (text: string, url: string, addEOL = false): string {
      return `<a href="${url}">${text}</a>` + (addEOL ? os.EOL : '');
    };

    const refsSize = opts.exportRes.refs.length;
    const firstRef = refsSize > 0 ? opts.exportRes.refs?.[0] : undefined;
    const firstSummary = firstRef ? opts.exportRes.summaries?.[firstRef] : undefined;
    const dbcAccount = opts.driver === 'cloud' && opts.endpoint ? opts.endpoint?.replace(/^cloud:\/\//, '').split('/')[0] : undefined;

    const sum = core.summary.addHeading('Docker Build summary', 2);

    if (dbcAccount && refsSize === 1 && firstRef && firstSummary) {
      const buildURL = GitHubSummary.formatDBCBuildURL(dbcAccount, firstRef, firstSummary.defaultPlatform);
      // prettier-ignore
      sum.addRaw(`<p>`)
        .addRaw(`For a detailed look at the build, you can check the results at:`)
      .addRaw('</p>')
      .addRaw(`<p>`)
        .addRaw(`:whale: ${addLink(`<strong>${buildURL}</strong>`, buildURL)}`)
      .addRaw(`</p>`);
    }

    if (opts.uploadRes) {
      // we just need the last two parts of the URL as they are always relative
      // to the workflow run URL otherwise URL could be broken if GitHub
      // repository name is part of a secret value used in the workflow. e.g.:
      //  artifact: https://github.com/docker/actions-toolkit/actions/runs/9552208295/artifacts/1609622746
      //  workflow: https://github.com/docker/actions-toolkit/actions/runs/9552208295
      // https://github.com/docker/actions-toolkit/issues/367
      const artifactRelativeURL = `./${GitHub.runId}/${opts.uploadRes.url.split('/').slice(-2).join('/')}`;

      if (dbcAccount && refsSize === 1) {
        // prettier-ignore
        sum.addRaw(`<p>`)
          .addRaw(`You can also download the following build record archive and import it into Docker Desktop's Builds view. `)
          .addBreak()
          .addRaw(`Build records include details such as timing, dependencies, results, logs, traces, and other information about a build. `)
          .addRaw(addLink('Learn more', 'https://www.docker.com/blog/new-beta-feature-deep-dive-into-github-actions-docker-builds-with-docker-desktop/?utm_source=github&utm_medium=actions'))
        .addRaw('</p>')
      } else {
        // prettier-ignore
        sum.addRaw(`<p>`)
          .addRaw(`For a detailed look at the build, download the following build record archive and import it into Docker Desktop's Builds view. `)
          .addBreak()
          .addRaw(`Build records include details such as timing, dependencies, results, logs, traces, and other information about a build. `)
          .addRaw(addLink('Learn more', 'https://www.docker.com/blog/new-beta-feature-deep-dive-into-github-actions-docker-builds-with-docker-desktop/?utm_source=github&utm_medium=actions'))
        .addRaw('</p>')
      }

      // prettier-ignore
      sum.addRaw(`<p>`)
        .addRaw(`:arrow_down: ${addLink(`<strong>${Util.stringToUnicodeEntities(opts.uploadRes.filename)}</strong>`, artifactRelativeURL)} (${Util.formatFileSize(opts.uploadRes.size)} - includes <strong>${refsSize} build record${refsSize > 1 ? 's' : ''}</strong>)`)
      .addRaw(`</p>`);
    } else if (opts.exportRes.summaries) {
      // prettier-ignore
      sum.addRaw(`<p>`)
        .addRaw(`The following table provides a brief summary of your build.`)
        .addBreak()
        .addRaw(`For a detailed look at the build, including timing, dependencies, results, logs, traces, and other information, consider enabling the export of the build record so you can import it into Docker Desktop's Builds view. `)
        .addRaw(addLink('Learn more', 'https://www.docker.com/blog/new-beta-feature-deep-dive-into-github-actions-docker-builds-with-docker-desktop/?utm_source=github&utm_medium=actions'))
      .addRaw(`</p>`);
    }

    // Feedback survey
    sum.addRaw(`<p>`).addRaw(`Find this useful? `).addRaw(addLink('Let us know', 'https://docs.docker.com/feedback/gha-build-summary')).addRaw('</p>');

    if (opts.exportRes.summaries) {
      // Preview
      sum.addRaw('<p>');
      const summaryTableData: Array<Array<SummaryTableCell>> = [
        // prettier-ignore
        [
          {header: true, data: 'ID'},
          {header: true, data: 'Name'},
          {header: true, data: 'Status'},
          {header: true, data: 'Cached'},
          {header: true, data: 'Duration'},
          ...(dbcAccount && refsSize > 1 ? [{header: true, data: 'Build result URL'}] : [])
        ]
      ];
      let buildError: string | undefined;
      for (const ref in opts.exportRes.summaries) {
        if (Object.prototype.hasOwnProperty.call(opts.exportRes.summaries, ref)) {
          const summary = opts.exportRes.summaries[ref];
          // prettier-ignore
          summaryTableData.push([
            {data: `<code>${ref.substring(0, 6).toUpperCase()}</code>`},
            {data: `<strong>${Util.stringToUnicodeEntities(summary.name)}</strong>`},
            {data: `${summary.status === 'completed' ? ':white_check_mark:' : summary.status === 'canceled' ? ':no_entry_sign:' : ':x:'} ${summary.status}`},
            {data: `${summary.numCachedSteps > 0 ? Math.round((summary.numCachedSteps / summary.numTotalSteps) * 100) : 0}%`},
            {data: summary.duration},
            ...(dbcAccount && refsSize > 1 ? [{data: addLink(':whale: Open', GitHubSummary.formatDBCBuildURL(dbcAccount, ref, summary.defaultPlatform))}] : [])
          ]);
          if (summary.error) {
            buildError = summary.error;
          }
        }
      }
      sum.addTable([...summaryTableData]);
      sum.addRaw(`</p>`);

      // Build error
      if (buildError) {
        sum.addRaw(`<blockquote>`);
        if (Util.countLines(buildError) > 10) {
          // prettier-ignore
          sum
          .addRaw(`<details><summary><strong>Error</strong></summary>`)
            .addCodeBlock(he.encode(buildError), 'text')
          .addRaw(`</details>`);
        } else {
          // prettier-ignore
          sum
          .addRaw(`<strong>Error</strong>`)
          .addBreak()
          .addRaw(`<p>`)
            .addCodeBlock(he.encode(buildError), 'text')
          .addRaw(`</p>`);
        }
        sum.addRaw(`</blockquote>`);
      }
    }

    // Build inputs
    if (opts.inputs) {
      // prettier-ignore
      sum.addRaw(`<details><summary><strong>Build inputs</strong></summary>`)
        .addCodeBlock(
          yamldump(opts.inputs, {
            indent: 2,
            lineWidth: -1
          }), 'yaml'
        )
        .addRaw(`</details>`);
    }

    // Bake definition
    if (opts.bakeDefinition) {
      // prettier-ignore
      sum.addRaw(`<details><summary><strong>Bake definition</strong></summary>`)
        .addCodeBlock(JSON.stringify(opts.bakeDefinition, null, 2), 'json')
        .addRaw(`</details>`);
    }

    core.info(`Writing summary`);
    await sum.addSeparator().write();
  }

  private static formatDBCBuildURL(account: string, ref: string, platform?: string): string {
    return `https://app.docker.com/build/accounts/${account}/builds/${(platform ?? 'linux/amd64').replace('/', '-')}/${ref}`;
  }
}
