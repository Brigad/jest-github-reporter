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
          const numbers = message.match(
            new RegExp(`${result.testFilePath}:(\\d+):\\d+`)
          );
          const start_line = numbers ? Number(numbers[1]) : location.line || 0;

          annotations.push({
            path: path.relative(process.cwd(), testFilePath),
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
    name: 'Test',
    annotations: createAnnotations(results.testResults),
    errorCount: results.numFailedTests,
    appId: Number(process.env.JEST_APP_ID),
    privateKey: process.env.JEST_PRIVATE_KEY
  });
};
