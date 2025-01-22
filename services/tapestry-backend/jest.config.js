module.exports = {
    testEnvironment: 'node',
    testMatch: ['**/*.test.js'],
    moduleFileExtensions: ['js'],
    testEnvironmentOptions: {
        // Ignore console.log and related functions during tests
        silent: true,
    },
};