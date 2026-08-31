declare module '@jspawn/qpdf-wasm' {
  export default function qpdfModule(options?: any): Promise<any>;
}

declare module '@jspawn/qpdf-wasm/qpdf.js' {
  export default function qpdfModule(options?: any): Promise<any>;
}

declare module '*?url' {
  const url: string;
  export default url;
}
