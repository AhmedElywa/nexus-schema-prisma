module.exports = {
  backend: {
    generator: 'nexus',
    onDelete: true,
    excludeQueriesAndMutations: ['aggregate'],
  },
}
