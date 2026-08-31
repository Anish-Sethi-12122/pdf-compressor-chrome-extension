import type { CompressionEngine, CompressionOptions, CompressionResult } from './CompressionEngine';
import qpdfModule from '@jspawn/qpdf-wasm/qpdf.js';
import qpdfWasmUrl from '@jspawn/qpdf-wasm/qpdf.wasm?url';

export class QpdfCompressionEngine implements CompressionEngine {
  private modPromise: Promise<any> | null = null;

  private async getModule() {
    if (!this.modPromise) {
      this.modPromise = qpdfModule({
        locateFile: (path: string) => {
          if (path.endsWith('.wasm')) {
            return qpdfWasmUrl;
          }
          return path;
        },
      });
    }
    return this.modPromise;
  }

  async compress(input: Uint8Array, _options?: CompressionOptions): Promise<CompressionResult> {
    try {
      const mod = await this.getModule();

      const inputFilename = 'input.pdf';
      const outputFilename = 'output.pdf';

      console.log(`Writing input file of size: ${input.length}`);
      
      // Write input file to Emscripten FS
      mod.FS.writeFile(inputFilename, input);

      // Run qpdf with structural optimization flags
      // Based on Phase 4, typical commands for compression:
      // --linearize (optional, but good for web), --object-streams=generate, 
      // --stream-data=compress
      // Recompress flate streams is standard when stream-data=compress is used.
      const args = [
        inputFilename,
        outputFilename,
        '--object-streams=generate',
        '--stream-data=compress',
        '--recompress-flate'
      ];
      
      const result = mod.callMain(args);

      if (result !== 0 && result !== 2 && result !== 3) {
        return {
          ok: false,
          reason: 'compression_error',
          message: `qpdf exited with code ${result}`,
        };
      }

      let output;
      try {
        output = mod.FS.readFile(outputFilename);
      } catch (e) {
        if (result !== 0) {
          return {
            ok: false,
            reason: 'compression_error',
            message: `qpdf exited with code ${result} and produced no output`,
          };
        }
        throw e;
      }
      
      // Clean up FS
      mod.FS.unlink(inputFilename);
      mod.FS.unlink(outputFilename);

      if (!output || output.length === 0) {
        return {
          ok: false,
          reason: 'invalid_output',
          message: 'qpdf produced empty output',
        };
      }

      const inputBytes = input.length;
      const outputBytes = output.length;
      
      let finalOutput = output;
      let changed = true;

      // Passthrough rule: if not smaller, keep original
      if (outputBytes >= inputBytes) {
        finalOutput = input;
        changed = false;
      }

      const savedBytes = inputBytes - finalOutput.length;
      const savedPercent = changed ? (savedBytes / inputBytes) * 100 : 0;

      return {
        ok: true,
        inputBytes,
        outputBytes: finalOutput.length,
        output: finalOutput,
        savedBytes,
        savedPercent,
        changed,
      };

    } catch (e: any) {
      return {
        ok: false,
        reason: 'compression_error',
        message: e?.message || 'Unknown error during compression',
      };
    }
  }
}
