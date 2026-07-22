import { useState } from 'react';

interface IframePanelProps {
  src: string;
  title: string;
}

export default function IframePanel({ src, title }: IframePanelProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="thp-iframe-wrap">
      <div className="thp-iframe-toolbar">
        <span className="thp-iframe-source">{title}</span>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="thp-btn thp-btn-secondary thp-iframe-openbtn"
        >
          Abrir en pestaña nueva ↗
        </a>
      </div>
      <div className="thp-iframe-body">
        {!loaded && (
          <div className="thp-iframe-loading" aria-live="polite">
            Cargando {title}…
          </div>
        )}
        <iframe
          key={src}
          src={src}
          title={title}
          onLoad={() => setLoaded(true)}
          className="thp-iframe"
        />
      </div>
    </div>
  );
}
