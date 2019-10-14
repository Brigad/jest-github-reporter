import path from 'path';
import stripAnsi from 'strip-ansi';
import Octokit from '@octokit/rest';
import createCheck from 'create-check';

interface Location {
  column: number;
  line: number;
}

function createAnnotations(results: jest.TestResult[]) {
  const annotations: Octokit.ChecksCreateParamsOutputAnnotations[] = [];

  for (const result of results) {
    const { testFilePath, testResults } = result;

    for (const failure of testResults) {
      if ('location' in failure) {
        const { location = {} as Location, failureMessages } = failure as {
          failureMessages: string[];
          location: Location;
        };

        failureMessages.forEach(message => {
          const filePath = testFilePath.replace('/index.test.ts', '');

          const res = message.match(
            new RegExp(`${filePath}/(.*\.test\.ts):(\\d+):\\d+`)
          );
          if (!res) {
            annotations.push({
              path: path.relative(
                path.resolve(process.cwd(), '../..'),
                testFilePath
              ),
              start_line: 0,
              end_line: 0,
              annotation_level: 'failure',
              message: failureMessages.map(stripAnsi).join('\n')
            });
            return;
          }
          const [_, file, line] = res;
          const start_line = line ? Number(line) : 0;

          annotations.push({
            path: path.relative(
              path.resolve(process.cwd(), '../..'),
              file ? `${filePath}/${file}` : testFilePath
            ),
            start_line,
            end_line: start_line,
            annotation_level: 'failure',
            message: failureMessages.map(stripAnsi).join('\n')
          });
        });
      }
    }
  }

  return annotations;
}

export default (results: ReturnType<jest.TestResultsProcessor>) => {
  if (!process.env.JEST_APP_ID || !process.env.JEST_PRIVATE_KEY) {
    return [];
  }

  return createCheck({
    tool: 'Jest',
    name: process.env.PACKAGE ? 'Tests of ' + process.env.PACKAGE : 'Tests',
    annotations: createAnnotations(results.testResults),
    errorCount: results.numFailedTests,
    appId: Number(process.env.JEST_APP_ID),
    privateKey: Buffer.from(process.env.JEST_PRIVATE_KEY, 'base64').toString(
      'utf8'
    )
  });
};
