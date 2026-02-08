import React, { useEffect, useRef, useState } from 'react';
import { AspectRatio, generateCinematicVideo } from '../services/api-client';

interface CinematicGeneratorProps {
  onClose: () => void;
}

const DEFAULT_PROMPT =
  'Crie uma cena cinematográfica suave com deslocamento de câmera, luz volumétrica e sensação de tensão tática.';

const parseImageDataUrl = (dataUrl: string) => {
  const [metadata, base64] = dataUrl.split(',');
  const mimeType = metadata?.split(';')[0]?.replace('data:', '') || '';
  if (!base64 || !mimeType) {
    throw new Error('Formato de imagem inválido.');
  }
  return {
    base64,
    mimeType,
  };
};

const isAllowedImageType = (mimeType: string) => /image\/(png|jpeg|jpg|webp)/i.test(mimeType);

const CinematicGenerator: React.FC<CinematicGeneratorProps> = ({ onClose }) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const requestAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      requestAbortRef.current?.abort();
      if (generatedVideoUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(generatedVideoUrl);
      }
    };
  }, [generatedVideoUrl]);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!isAllowedImageType(file.type)) {
      setError('Formato de imagem não suportado. Use PNG, JPG ou WEBP.');
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      setError('Imagem muito grande. Use no máximo 4MB.');
      return;
    }

    setError('');
    const reader = new FileReader();
    reader.onloadend = () => setSelectedImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const startGeneration = async () => {
    if (!selectedImage) {
      setError('Selecione uma imagem antes de iniciar.');
      return;
    }

    setError('');
    setIsGenerating(true);
    setGeneratedVideoUrl((previous) => {
      if (previous?.startsWith('blob:')) URL.revokeObjectURL(previous);
      return null;
    });

    requestAbortRef.current?.abort();
    const abortController = new AbortController();
    requestAbortRef.current = abortController;

    try {
      const imagePayload = parseImageDataUrl(selectedImage);
      if (!isAllowedImageType(imagePayload.mimeType)) {
        throw new Error('Formato de imagem não suportado.');
      }

      setStatus('Enviando quadro de referência para o backend...');
      const blob = await generateCinematicVideo({
        prompt: prompt.trim() || DEFAULT_PROMPT,
        aspectRatio,
        image: imagePayload,
        signal: abortController.signal,
      });

      const objectUrl = URL.createObjectURL(blob);
      setGeneratedVideoUrl(objectUrl);
      setStatus('Sequência renderizada com sucesso.');
    } catch (generationError: any) {
      if (abortController.signal.aborted) {
        setStatus('');
        setError('Geração cancelada.');
      } else {
        setError(generationError?.message || 'Erro inesperado ao gerar sequência.');
        setStatus('');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const cancelGeneration = () => {
    requestAbortRef.current?.abort();
    setIsGenerating(false);
    setStatus('');
  };

  return (
    <div className="overlay-root" role="dialog" aria-modal="true" aria-label="Gerador cinematográfico">
      <div className="overlay-card cinematic-modal">
        <header className="overlay-header">
          <div>
            <p>Cinematic Engine</p>
            <h2>Gerador de Sequência</h2>
          </div>
          <button type="button" onClick={onClose} className="ghost-btn">
            Fechar
          </button>
        </header>

        <div className="cinematic-grid">
          <section className="cinematic-controls">
            <label className="field-label">Pipeline</label>
            <p className="status-caption">A geração usa a API protegida no backend. Nenhuma API key fica no navegador.</p>

            <label className="field-label">Prompt</label>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              className="field-input field-area"
              maxLength={340}
            />

            <label className="field-label">Aspect Ratio</label>
            <div className="ratio-grid">
              <button
                type="button"
                className={aspectRatio === '16:9' ? 'pill-btn selected' : 'pill-btn'}
                onClick={() => setAspectRatio('16:9')}
              >
                Paisagem 16:9
              </button>
              <button
                type="button"
                className={aspectRatio === '9:16' ? 'pill-btn selected' : 'pill-btn'}
                onClick={() => setAspectRatio('9:16')}
              >
                Retrato 9:16
              </button>
            </div>

            <button type="button" onClick={() => fileInputRef.current?.click()} className="secondary-btn">
              {selectedImage ? 'Trocar Imagem' : 'Selecionar Imagem'}
            </button>
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={handleImageUpload} />

            <button
              type="button"
              className="primary-btn"
              onClick={startGeneration}
              disabled={isGenerating || !selectedImage}
            >
              {isGenerating ? 'Gerando...' : 'Gerar Vídeo'}
            </button>

            {isGenerating ? (
              <button type="button" className="ghost-btn" onClick={cancelGeneration}>
                Cancelar geração
              </button>
            ) : null}

            {status ? <p className="status-message">{status}</p> : null}
            {error ? <p className="error-message">{error}</p> : null}
          </section>

          <section className="cinematic-preview">
            {generatedVideoUrl ? (
              <video src={generatedVideoUrl} controls autoPlay loop className="preview-video" />
            ) : selectedImage ? (
              <img src={selectedImage} alt="Prévia" className="preview-image" />
            ) : (
              <p>Selecione uma imagem para iniciar.</p>
            )}
            {generatedVideoUrl ? (
              <a href={generatedVideoUrl} download="gesturestrike-cinematic.mp4" className="secondary-btn">
                Download MP4
              </a>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
};

export default CinematicGenerator;
