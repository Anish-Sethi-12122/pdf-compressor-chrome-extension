export type CompressionOptions = {
  compressionLevel?: number;
};

export type CompressionResult =
  | {
      ok: true;
      inputBytes: number;
      outputBytes: number;
      output: Uint8Array;
      savedBytes: number;
      savedPercent: number;
      changed: boolean;
    }
  | {
      ok: false;
      reason: 'compression_error' | 'invalid_output' | 'initialization_error';
      message: string;
    };

export interface CompressionEngine {
  compress(
    input: Uint8Array,
    options?: CompressionOptions
  ): Promise<CompressionResult>;
}
