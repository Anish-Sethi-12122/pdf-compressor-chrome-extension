/**
 * Type declarations for the custom qpdf WASM module (Phase 7A).
 *
 * The module is produced by Emscripten with:
 *   em++ qpdf_wrapper.cpp ... -sMODULARIZE=1 -sEXPORT_NAME=createQpdfModule
 *
 * The exported function is createQpdfModule(opts?) → Promise<QpdfModule>.
 * All qpdf API is accessed via the PDFCompressor Embind class.
 */

/** Raw image descriptor returned by PDFCompressor.inspectImages() */
export interface RawImageInfo {
  objectId: number;
  generation: number;
  width: number;
  height: number;
  bitsPerComponent: number;
  colorSpace: string;
  filter: string;
  hasMask: boolean;
  streamLength: number;
  filterIsArray: boolean;
}

/** Bound PDFCompressor class instance */
export interface PDFCompressor {
  /** Returns array of image XObject descriptors from the loaded PDF. */
  inspectImages(): RawImageInfo[];

  /**
   * Replace the JPEG stream of a specific image object.
   * Also updates /Width and /Height in the dict when dimensions change.
   */
  replaceImage(
    objId: number,
    gen: number,
    jpegData: Uint8Array,
    newWidth: number,
    newHeight: number,
  ): void;

  /**
   * Write with full structural optimisation flags:
   *   --object-streams=generate --stream-data=compress --recompress-flate
   * Returns a new Uint8Array (does NOT mutate the internal QPDF state).
   */
  structuralOptimize(): Uint8Array;

  /**
   * Write current state preserving stream data (use between optimise passes).
   * Returns a new Uint8Array.
   */
  save(): Uint8Array;

  /** Returns the document page count, for output validation. */
  getPageCount(): number;
}

/** Shape of the initialised WASM module */
export interface QpdfModule {
  PDFCompressor: new (pdfData: Uint8Array) => PDFCompressor;
}

/** Module factory returned by Emscripten (matches EXPORT_NAME=createQpdfModule) */
declare function createQpdfModule(options?: {
  locateFile?: (path: string, prefix: string) => string;
}): Promise<QpdfModule>;

export default createQpdfModule;

// Allow Vite to import the WASM asset URL
declare module '*/qpdf_wrapper.wasm?url' {
  const url: string;
  export default url;
}
