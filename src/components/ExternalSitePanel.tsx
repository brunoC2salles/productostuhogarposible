interface ExternalSitePanelProps {
  src: string;
  title: string;
  description: string;
}

export default function ExternalSitePanel({ src, title, description }: ExternalSitePanelProps) {
  return (
    <div className="thp-external-panel">
      <div className="thp-external-card">
        <span className="thp-external-eyebrow">Colaboración externa</span>
        <h2>{title}</h2>
        <p>{description}</p>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="thp-btn thp-external-cta"
        >
          Abrir en pestaña nueva ↗
        </a>
      </div>
    </div>
  );
}
