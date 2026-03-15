// PHASE2_DISABLED — Tree-sitter code chunking for semantic code search
// Not part of EngineeringOS Phase 1. Re-enable by setting PHASE2_ENABLED=true.

import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import TypeScript from 'tree-sitter-typescript';
import Python from 'tree-sitter-python';
import path from 'path';

export interface CodeChunk {
  filePath: string;
  content: string;
  chunkType: 'function' | 'class' | 'file_summary';
  functionName?: string;
  startLine: number;
  endLine: number;
  language: string;
  metadata: Record<string, any>;
}

// Regex patterns to detect function/class boundaries per language
const LANG_PATTERNS: Record<string, RegExp[]> = {
  go: [
    /^func\s+/,
    /^type\s+\w+\s+(struct|interface)\s*\{/,
  ],
  java: [
    /^\s*(public|private|protected|static|final|abstract|native|synchronized)\s+[\w<>\[\],\s]+\s+\w+\s*\(/,
    /^\s*(public|private|protected)?\s*(abstract\s+|final\s+|sealed\s+)?(class|interface|enum|record)\s+/,
  ],
  rust: [
    /^(pub(\(crate\))?\s+)?(async\s+)?fn\s+/,
    /^(pub(\(crate\))?\s+)?(struct|enum|trait|impl|type)\s+/,
  ],
  ruby: [
    /^\s*def\s+/,
    /^\s*(class|module)\s+/,
  ],
  php: [
    /^\s*(public|private|protected|static)?\s*function\s+/,
    /^\s*(abstract\s+|final\s+)?(class|interface|trait|enum)\s+/,
  ],
  cs: [
    /^\s*(public|private|protected|internal|static|override|virtual|abstract|async|partial)\s+[\w<>\[\],\s?]+\s+\w+\s*[\(\{]/,
    /^\s*(public|private|protected|internal)?\s*(abstract|sealed|static|partial)?\s*(class|interface|struct|enum|record)\s+/,
  ],
  kotlin: [
    /^\s*(override\s+|open\s+|abstract\s+|private\s+|protected\s+|public\s+|internal\s+)*(suspend\s+)?fun\s+/,
    /^\s*(data\s+|sealed\s+|abstract\s+|open\s+)?(class|object|interface)\s+/,
  ],
  swift: [
    /^\s*(public|private|internal|open|fileprivate)?\s*(static\s+|class\s+|override\s+)?(func|init|deinit)\s+/,
    /^\s*(public|private|internal|open|fileprivate)?\s*(final\s+)?(class|struct|enum|protocol|extension|actor)\s+/,
  ],
};

export class ChunkingService {
  private jsParser: Parser;
  private tsParser: Parser;
  private pyParser: Parser;

  constructor() {
    this.jsParser = new Parser();
    this.jsParser.setLanguage(JavaScript);
    this.tsParser = new Parser();
    this.tsParser.setLanguage(TypeScript.typescript);
    this.pyParser = new Parser();
    this.pyParser.setLanguage(Python);
  }

  detectLanguage(filePath: string): string | null {
    const ext = path.extname(filePath).toLowerCase();
    const map: Record<string, string> = {
      '.js': 'javascript', '.jsx': 'javascript',
      '.ts': 'typescript', '.tsx': 'typescript',
      '.py': 'python',
      '.go': 'go',
      '.java': 'java',
      '.rs': 'rust',
      '.rb': 'ruby',
      '.php': 'php',
      '.cs': 'cs',
      '.kt': 'kotlin', '.kts': 'kotlin',
      '.swift': 'swift',
      '.md': 'markdown', '.mdx': 'markdown',
      '.yaml': 'yaml', '.yml': 'yaml',
    };
    return map[ext] || null;
  }

  chunkFile(filePath: string, content: string): CodeChunk[] {
    const language = this.detectLanguage(filePath);
    if (!language) return [];

    // Tree-sitter languages
    if (language === 'javascript' || language === 'typescript' || language === 'python') {
      return this.chunkWithTreeSitter(filePath, content, language);
    }

    // Regex-based languages
    if (LANG_PATTERNS[language]) {
      return this.chunkWithRegex(filePath, content, language);
    }

    // Sliding window for markdown, yaml, and anything else
    return this.slidingWindow(filePath, content, language);
  }

  private chunkWithTreeSitter(filePath: string, content: string, language: string): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    const lines = content.split('\n');

    try {
      let tree: Parser.Tree;
      if (language === 'javascript') tree = this.jsParser.parse(content);
      else if (language === 'typescript') tree = this.tsParser.parse(content);
      else tree = this.pyParser.parse(content);

      this.extractNodes(tree.rootNode, content, lines, filePath, language, chunks);

      if (chunks.length === 0 || lines.length < 50) {
        chunks.push({
          filePath, content: lines.slice(0, 100).join('\n'),
          chunkType: 'file_summary', startLine: 1,
          endLine: Math.min(100, lines.length), language, metadata: {},
        });
      }
    } catch {
      chunks.push({
        filePath, content: lines.slice(0, 100).join('\n'),
        chunkType: 'file_summary', startLine: 1,
        endLine: Math.min(100, lines.length), language, metadata: {},
      });
    }

    return chunks;
  }

  private chunkWithRegex(filePath: string, content: string, language: string): CodeChunk[] {
    const lines = content.split('\n');
    const patterns = LANG_PATTERNS[language];
    const boundaries: number[] = [];

    for (let i = 0; i < lines.length; i++) {
      if (patterns.some(p => p.test(lines[i]))) {
        boundaries.push(i);
      }
    }

    if (boundaries.length === 0) return this.slidingWindow(filePath, content, language);

    const chunks: CodeChunk[] = [];
    for (let i = 0; i < boundaries.length; i++) {
      const startIdx = boundaries[i];
      const endIdx = i + 1 < boundaries.length ? boundaries[i + 1] - 1 : lines.length - 1;
      const chunkLines = lines.slice(startIdx, endIdx + 1);
      const chunkContent = chunkLines.join('\n');

      if (chunkContent.trim().length < 10) continue;

      const name = this.extractNameFromLine(lines[startIdx]);

      chunks.push({
        filePath,
        content: `// ${filePath}:${startIdx + 1}\n${chunkContent.substring(0, 6000)}`,
        chunkType: 'function',
        functionName: name || undefined,
        startLine: startIdx + 1,
        endLine: endIdx + 1,
        language,
        metadata: { name: name || undefined },
      });
    }

    return chunks.length > 0 ? chunks : this.slidingWindow(filePath, content, language);
  }

  private slidingWindow(filePath: string, content: string, language: string): CodeChunk[] {
    const lines = content.split('\n');
    const chunks: CodeChunk[] = [];
    const WINDOW = 60;
    const OVERLAP = 10;

    if (lines.length <= WINDOW) {
      return [{
        filePath,
        content: `// ${filePath}:1\n${content.substring(0, 6000)}`,
        chunkType: 'file_summary',
        startLine: 1,
        endLine: lines.length,
        language,
        metadata: {},
      }];
    }

    let i = 0;
    while (i < lines.length) {
      const startLine = i;
      const endLine = Math.min(i + WINDOW - 1, lines.length - 1);
      const slice = lines.slice(startLine, endLine + 1).join('\n');
      chunks.push({
        filePath,
        content: `// ${filePath}:${startLine + 1}\n${slice.substring(0, 6000)}`,
        chunkType: 'file_summary',
        startLine: startLine + 1,
        endLine: endLine + 1,
        language,
        metadata: {},
      });
      i += WINDOW - OVERLAP;
      if (i >= lines.length) break;
    }

    return chunks;
  }

  private extractNameFromLine(line: string): string | null {
    const m = line.match(/\b(?:func|def|class|fn|fun|module|interface|struct|enum|trait|impl|type|record)\s+(\w+)/);
    return m ? m[1] : null;
  }

  private extractNodes(
    node: Parser.SyntaxNode, content: string, lines: string[],
    filePath: string, language: string, chunks: CodeChunk[]
  ): void {
    const functionTypes = new Set([
      'function_declaration', 'function_definition', 'arrow_function',
      'method_definition', 'function_expression',
    ]);
    const classTypes = new Set(['class_declaration', 'class_definition', 'class']);

    if (functionTypes.has(node.type)) {
      const name = this.getNodeName(node) || 'anonymous';
      const startLine = node.startPosition.row + 1;
      const endLine = node.endPosition.row + 1;
      const nodeContent = content.slice(node.startIndex, node.endIndex);
      chunks.push({
        filePath,
        content: `// ${filePath}:${startLine}\n${nodeContent.length > 6000 ? nodeContent.substring(0, 6000) + '\n// ... truncated' : nodeContent}`,
        chunkType: 'function', functionName: name, startLine, endLine, language, metadata: { name },
      });
    } else if (classTypes.has(node.type)) {
      const name = this.getNodeName(node) || 'AnonymousClass';
      const startLine = node.startPosition.row + 1;
      const endLine = node.endPosition.row + 1;
      const nodeContent = content.slice(node.startIndex, node.endIndex);
      chunks.push({
        filePath,
        content: `// ${filePath}:${startLine}\n${nodeContent.length > 6000 ? nodeContent.substring(0, 6000) + '\n// ... truncated' : nodeContent}`,
        chunkType: 'class', functionName: name, startLine, endLine, language, metadata: { name },
      });
    }

    for (const child of node.children) {
      this.extractNodes(child, content, lines, filePath, language, chunks);
    }
  }

  private getNodeName(node: Parser.SyntaxNode): string | null {
    for (const child of node.children) {
      if (child.type === 'identifier' || child.type === 'name' || child.type === 'property_identifier') {
        return child.text;
      }
    }
    return null;
  }
}

export const chunkingService = new ChunkingService();
