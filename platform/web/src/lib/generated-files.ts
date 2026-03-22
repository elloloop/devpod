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

export function getFileIcon(
  _path: string,
  status: "added" | "modified" | "deleted" | "renamed"
): string {
  switch (status) {
    case "added":
      return "+";
    case "deleted":
      return "-";
    case "renamed":
      return "R";
    case "modified":
    default:
      return "M";
  }
}
