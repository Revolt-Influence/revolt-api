module.exports = {
  roots: [`${__dirname}/test`],
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
  testRegex: '(/tests/.*|(\\.|/)(test|spec))\\.tsx?$',
  moduleFileExtensions: ['ts', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: ['**/src/**'],
  // setupTestFrameworkScriptFile: `${__dirname}/test/setup.ts`,
  testEnvironment: 'node',
}
