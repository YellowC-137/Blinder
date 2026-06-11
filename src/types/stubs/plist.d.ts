declare module 'plist' {
  export function parse(xml: string): Record<string, unknown>;
  export function build(obj: Record<string, unknown>): string;
}
