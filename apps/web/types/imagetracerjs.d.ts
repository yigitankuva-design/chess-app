declare module 'imagetracerjs' {
  interface ImageTracerStatic {
    imageToSVG(url: string, callback: (svgstring: string) => void, options?: Record<string, unknown>): void;
  }
  const ImageTracer: ImageTracerStatic;
  export default ImageTracer;
}
