export interface InlineComment {
  id: string;
  filePath: string;
  lineNumber: number;
  lineType: 'old' | 'new';
  text: string;
  timestamp: string;
}

export interface ReviewState {
  comments: InlineComment[];
  status: 'pending' | 'approved' | 'changes_requested';
}
