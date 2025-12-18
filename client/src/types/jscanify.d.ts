declare module "jscanify" {
  class jscanify {
    extractPaper(
      image: HTMLImageElement | HTMLCanvasElement,
      width: number,
      height: number
    ): HTMLCanvasElement | null;
  }
  export default jscanify;
}
