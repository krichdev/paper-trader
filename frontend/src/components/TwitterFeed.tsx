import { useEffect, useState } from 'react';
import { Twitter, ChevronDown, ChevronUp } from 'lucide-react';

interface TwitterFeedProps {
  homeTeam?: string;
  awayTeam?: string;
  league?: string;
}

export function TwitterFeed({ homeTeam, awayTeam, league }: TwitterFeedProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [widgetLoaded, setWidgetLoaded] = useState(false);

  // Load Twitter widget script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://platform.twitter.com/widgets.js';
    script.async = true;
    script.charset = 'utf-8';

    script.onload = () => {
      setWidgetLoaded(true);
      // Trigger Twitter widget rendering
      if ((window as any).twttr) {
        (window as any).twttr.widgets.load();
      }
    };

    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  // Generate search query from team names and league
  const searchQuery = (() => {
    const terms: string[] = [];

    if (homeTeam) terms.push(homeTeam);
    if (awayTeam) terms.push(awayTeam);
    if (league) terms.push(`#${league}`);

    return terms.join(' OR ');
  })();

  if (!searchQuery) {
    return (
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <div className="flex items-center gap-2 mb-4">
          <Twitter className="text-blue-400" size={20} />
          <h3 className="text-lg font-bold">Twitter Feed</h3>
        </div>
        <p className="text-slate-400 text-sm">No team information available</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      {/* Header */}
      <div
        className="p-4 flex items-center justify-between cursor-pointer md:cursor-default hover:bg-slate-750 md:hover:bg-transparent transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Twitter className="text-blue-400" size={20} />
          <h3 className="text-lg font-bold">Twitter Feed</h3>
        </div>
        <button className="md:hidden">
          {isExpanded ? (
            <ChevronUp className="text-slate-400" size={20} />
          ) : (
            <ChevronDown className="text-slate-400" size={20} />
          )}
        </button>
      </div>

      {/* Twitter Timeline */}
      <div className={`${isExpanded ? 'block' : 'hidden'} md:block`}>
        {widgetLoaded ? (
          <div className="p-4 pt-0">
            <a
              className="twitter-timeline"
              data-theme="dark"
              data-height="600"
              data-chrome="noheader nofooter noborders transparent"
              href={`https://twitter.com/search?q=${encodeURIComponent(searchQuery)}&f=live`}
            >
              Loading tweets about {homeTeam} vs {awayTeam}...
            </a>
          </div>
        ) : (
          <div className="p-4 pt-0">
            <div className="bg-slate-700/50 rounded-lg p-6 flex flex-col items-center justify-center h-96">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mb-3"></div>
              <p className="text-slate-400 text-sm">Loading Twitter feed...</p>
            </div>
          </div>
        )}

        {/* Fallback for blocked Twitter */}
        <noscript>
          <div className="p-4 pt-0">
            <div className="bg-slate-700/50 rounded-lg p-6 text-center">
              <Twitter className="text-blue-400 mx-auto mb-3" size={32} />
              <p className="text-slate-400 mb-2">Twitter feed requires JavaScript</p>
              <a
                href={`https://twitter.com/search?q=${encodeURIComponent(searchQuery)}&f=live`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline text-sm"
              >
                View on Twitter →
              </a>
            </div>
          </div>
        </noscript>
      </div>
    </div>
  );
}
