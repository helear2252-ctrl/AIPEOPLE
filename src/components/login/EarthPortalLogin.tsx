import { KeyboardEvent, useCallback, useState } from 'react';
import './EarthPortalLogin.css';

type PortalState = 'idle' | 'entering';

export default function EarthPortalLogin() {
  const [status, setStatus] = useState<PortalState>('idle');

  const enterWebsite = useCallback(() => {
    if (status === 'entering') return;

    setStatus('entering');
    window.setTimeout(() => {
      window.location.href = import.meta.env.BASE_URL;
    }, 600);
  }, [status]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      enterWebsite();
    }
  };

  return (
    <main className={`earth-portal ${status === 'entering' ? 'is-entering' : ''}`}>
      <div className="portal-nebula portal-nebula--one" aria-hidden="true" />
      <div className="portal-nebula portal-nebula--two" aria-hidden="true" />
      <div className="portal-stars" aria-hidden="true" />

      <section className="portal-content" aria-live="polite">
        <p className="portal-kicker"><span /> EARTH PORTAL <span /></p>

        <div
          className="earth-trigger"
          role="button"
          tabIndex={status === 'entering' ? -1 : 0}
          aria-label="點擊地球進入網站"
          aria-disabled={status === 'entering'}
          onClick={enterWebsite}
          onKeyDown={handleKeyDown}
        >
          <div className="pulse-ring pulse-ring--one" aria-hidden="true" />
          <div className="pulse-ring pulse-ring--two" aria-hidden="true" />
          <div className="orbit orbit--one" aria-hidden="true"><i /><i /><i /></div>
          <div className="orbit orbit--two" aria-hidden="true"><i /><i /></div>
          <div className="earth-glow" aria-hidden="true" />
          <div className="earth-sphere" aria-hidden="true">
            <div className="earth-image" />
            <div className="earth-shade" />
            <div className="earth-scan" />
          </div>
          <div className="entry-flash" aria-hidden="true" />
        </div>

        <div className="portal-platform" aria-hidden="true">
          <span /><span /><span />
        </div>

        <p className="portal-instruction">
          <span className="instruction-dot" />
          {status === 'entering' ? '正在進入...' : '點擊地球進入'}
          <span className="instruction-dot" />
        </p>
      </section>
    </main>
  );
}
