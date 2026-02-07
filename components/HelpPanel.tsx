import React, { useEffect, useRef } from 'react';

interface HelpPanelProps {
  onClose: () => void;
}

const HelpPanel: React.FC<HelpPanelProps> = ({ onClose }) => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  return (
    <section className="overlay-root" role="dialog" aria-modal="true" aria-labelledby="help-title">
      <div className="overlay-card compact help-card">
        <p>Guia rápido</p>
        <h2 id="help-title">Comandos e Atalhos</h2>
        <p>Use este painel para aprender os gestos e os atalhos de teclado durante a partida.</p>

        <div className="help-grid">
          <article>
            <h3>Movimento (mão esquerda)</h3>
            <ul>
              <li>Cima: avançar</li>
              <li>Baixo: recuar</li>
              <li>Esquerda/Direita: strafe</li>
              <li>Punho fechado: parar</li>
            </ul>
          </article>

          <article>
            <h3>Combate (mão direita)</h3>
            <ul>
              <li>Gesto de arma: mira padrão</li>
              <li>Indicador curvado: disparo</li>
              <li>Médio estendido: iron sight</li>
              <li>Mão aberta: recarga</li>
            </ul>
          </article>

          <article>
            <h3>Atalhos de teclado</h3>
            <ul>
              <li>P: pausar/retomar</li>
              <li>C: abrir calibração</li>
              <li>V: abrir modo cinematográfico</li>
              <li>H ou ?: abrir ajuda</li>
              <li>Esc: fechar modais</li>
            </ul>
          </article>
        </div>

        <div className="button-row">
          <button ref={closeButtonRef} type="button" className="primary-btn" onClick={onClose}>
            Entendi
          </button>
        </div>
      </div>
    </section>
  );
};

export default HelpPanel;
