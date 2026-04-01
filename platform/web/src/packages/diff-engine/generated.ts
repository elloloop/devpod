const GENERATED_FILE_PATTERNS = [
  /package-lock\.json$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/,
  /Podfile\.lock$/,
  /\.lock$/,
  /dist\//,
  /\.next\//,
  /build\//,
  /coverage\//,
  /\.min\.(js|css)$/,
  /\.map$/,
  /\.d\.ts$/,
  /node_modules\//,
  /vendor\//,
  /generated\//,
  /__generated__\//,
  /\.pb\.(go|ts|js)$/,
  /\.swagger\.json$/,
];

export function isGeneratedFile(path: string): boolean {
  return GENERATED_FILE_PATTERNS.some((pattern) => pattern.test(path));
}
