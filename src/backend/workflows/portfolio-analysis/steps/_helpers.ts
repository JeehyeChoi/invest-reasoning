export function requireArtifact<T>(
  artifact: T | undefined,
  name: string,
): T {
  if (!artifact) {
    throw new Error(`Required artifact missing: ${name}`);
  }

  return artifact;
}
