export type AspectRatio = '16:9' | '9:16';

interface GenerateCinematicInput {
  prompt: string;
  aspectRatio: AspectRatio;
  image: {
    base64: string;
    mimeType: string;
  };
  signal?: AbortSignal;
}

const DEFAULT_API_BASE_URL = 'http://localhost:8787/api/v1';
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL).replace(/\/$/, '');

interface ErrorShape {
  message?: string;
}

const decodeBase64ToBlob = (base64: string, mimeType: string) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
};

const getErrorMessage = async (response: Response) => {
  try {
    const payload = (await response.json()) as ErrorShape;
    if (payload.message) return payload.message;
  } catch {
    // Ignore parse errors and use fallback below.
  }

  if (response.status === 503) {
    return 'Serviço cinematográfico indisponível no servidor.';
  }
  return 'Falha ao gerar vídeo cinematográfico.';
};

export const generateCinematicVideo = async (input: GenerateCinematicInput): Promise<Blob> => {
  const response = await fetch(`${API_BASE_URL}/cinematics/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: input.prompt,
      aspectRatio: input.aspectRatio,
      image: input.image,
    }),
    signal: input.signal,
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  const payload = (await response.json()) as {
    video?: { base64?: string; mimeType?: string };
  };

  const videoBase64 = payload.video?.base64;
  const mimeType = payload.video?.mimeType ?? 'video/mp4';

  if (!videoBase64) {
    throw new Error('Servidor não retornou conteúdo de vídeo.');
  }

  return decodeBase64ToBlob(videoBase64, mimeType);
};
