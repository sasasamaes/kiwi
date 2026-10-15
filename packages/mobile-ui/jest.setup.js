// Monorepo hoisting: the root workspace resolves react 19.3.0 while this package
// pins Expo SDK 57's react 19.2.3. RNTL's peer-deps guard compares against the
// hoisted copy; skip it (documented escape hatch) so the pinned Expo versions run.
process.env.RNTL_SKIP_DEPS_CHECK = '1';
