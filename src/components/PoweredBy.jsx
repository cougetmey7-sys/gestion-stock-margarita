const SITE_URL = 'https://visualimpacto.com';

export default function PoweredBy() {
  return (
    <a className="powered-by" href={SITE_URL} target="_blank" rel="noopener noreferrer" aria-label="Hecho por Visual Impacto">
      <span>Hecho por</span>
      <span className="vi-mark">
        Visual <b>Impacto</b>
      </span>
    </a>
  );
}
