declare module 'web-tree-sitter' {
  export default class Parser {
    static init(options?: { locateFile?: (file: string) => string }): Promise<void>;
    setLanguage(language: Parser.Language): void;
    parse(input: string): Parser.Tree;
  }

  namespace Parser {
    class Language {
      static load(pathOrBuffer: string | Uint8Array): Promise<Language>;
    }

    interface Tree {
      rootNode: SyntaxNode;
      delete(): void;
    }

    interface SyntaxNode {
      type: string;
      text: string;
      startIndex: number;
      endIndex: number;
      childCount: number;
      children: SyntaxNode[];
      descendantForIndex(index: number): SyntaxNode | null;
    }
  }
}
