interface AIStudioBridge {
  hasSelectedApiKey: () => Promise<boolean>;
  openSelectKey: () => Promise<void>;
}

interface Window {
  Hands: new (opts: { locateFile: (file: string) => string }) => {
    setOptions: (opts: Record<string, unknown>) => void;
    onResults: (cb: (results: any) => void) => void;
    send: (payload: { image: HTMLVideoElement }) => Promise<void>;
    close?: () => Promise<void>;
  };
  HAND_CONNECTIONS: any;
  drawConnectors: (
    ctx: CanvasRenderingContext2D,
    landmarks: any,
    connections: any,
    options?: Record<string, unknown>,
  ) => void;
  drawLandmarks: (
    ctx: CanvasRenderingContext2D,
    landmarks: any,
    options?: Record<string, unknown>,
  ) => void;
  aistudio?: AIStudioBridge;
}

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
