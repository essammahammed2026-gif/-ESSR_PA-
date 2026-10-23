/**
 * Ambient type declarations for the experimental Browser EyeDropper API
 * Spec: https://wicg.github.io/eyedropper-api/
 */
interface EyeDropperOpenResult {
  sRGBHex: string;
}

interface EyeDropperOpenOptions {
  signal?: AbortSignal;
}

interface EyeDropperInstance {
  open(options?: EyeDropperOpenOptions): Promise<EyeDropperOpenResult>;
}

interface Window {
  EyeDropper?: {
    new (): EyeDropperInstance;
  };
}
