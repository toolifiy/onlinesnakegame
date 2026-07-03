import { useState, useEffect, useMemo } from 'react';

// Custom hook to track screen width dynamically with resize listener
export function useScreenWidth() {
  const [width, setWidth] = useState<number>(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleResize = () => {
      setWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    // Initial call to set the correct size
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return width;
}

interface AdsterraBannerProps {
  adKey: string;
  width: number;
  height: number;
}

export default function AdsterraBanner({ adKey, width, height }: AdsterraBannerProps) {
  const screenWidth = useScreenWidth();

  const isHorizontalBanner = height <= 100 || width > height;

  // Dynamically determine the optimized key and dimensions based on screen width
  const { finalKey, finalWidth, finalHeight, label } = useMemo(() => {
    if (isHorizontalBanner) {
      if (screenWidth < 640) {
        // Mobile View: Compact mobile-sized banner (320x50)
        return {
          finalKey: 'db3a79e12aa161ce3f5a8e4e34162c60',
          finalWidth: 320,
          finalHeight: 50,
          label: 'Mobile Banner (320x50)'
        };
      } else if (screenWidth < 1024) {
        // Tablet View: Standard banner (468x60)
        return {
          finalKey: 'db3a79e12aa161ce3f5a8e4e34162c60',
          finalWidth: 468,
          finalHeight: 60,
          label: 'Tablet Banner (468x60)'
        };
      } else {
        // PC/Desktop View: Desktop leaderboard (728x90)
        return {
          finalKey: 'db3a79e12aa161ce3f5a8e4e34162c60',
          finalWidth: 728,
          finalHeight: 90,
          label: 'Desktop Leaderboard (728x90)'
        };
      }
    } else {
      // This is a large vertical ad (e.g., 160x300 or 160x600 skyscrapers)
      if (screenWidth < 768) {
        // Mobile View: Change to square-like box to prevent endless vertical scrolling!
        return {
          finalKey: 'bb6586562ba9e600bfde4e38d14ba022', // Use medium rectangle key
          finalWidth: 300,
          finalHeight: 250,
          label: 'Mobile Square Box (300x250)'
        };
      } else if (screenWidth < 1024) {
        // Tablet View: Compact rectangular ad (160x300)
        return {
          finalKey: 'c5bdb30469010828e32529cd44eafd76',
          finalWidth: 160,
          finalHeight: 300,
          label: 'Tablet Rectangle (160x300)'
        };
      } else {
        // PC/Desktop View: Full size wide skyscraper (160x600)
        return {
          finalKey: adKey,
          finalWidth: width,
          finalHeight: height,
          label: 'PC Skyscraper'
        };
      }
    }
  }, [adKey, width, height, isHorizontalBanner, screenWidth]);

  // Generate the sandboxed HTML document for the iframe to run the scripts in isolation
  const srcDoc = useMemo(() => {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            html, body {
              margin: 0;
              padding: 0;
              width: 100%;
              height: 100%;
              display: flex;
              justify-content: center;
              align-items: center;
              background-color: transparent;
              overflow: hidden;
            }
          </style>
        </head>
        <body>
          <div id="container-${finalKey}"></div>
          <script type="text/javascript">
            window.atOptions = {
              'key' : '${finalKey}',
              'format' : 'iframe',
              'height' : ${finalHeight},
              'width' : ${finalWidth},
              'params' : {}
            };
          </script>
          <script type="text/javascript" src="https://www.highperformanceformat.com/${finalKey}/invoke.js"></script>
        </body>
      </html>
    `;
  }, [finalKey, finalWidth, finalHeight]);

  const scaleFactor = useMemo(() => {
    // Leave some margin for padding (e.g., 32px) to prevent layout issues
    const availableWidth = screenWidth - 32;
    if (availableWidth < finalWidth) {
      return Math.max(0.4, availableWidth / finalWidth); // Cap scaling at minimum 40% to keep legible
    }
    return 1;
  }, [screenWidth, finalWidth]);

  const scaledWidth = useMemo(() => Math.floor(finalWidth * scaleFactor), [finalWidth, scaleFactor]);
  const scaledHeight = useMemo(() => Math.floor(finalHeight * scaleFactor), [finalHeight, scaleFactor]);

  return (
    <div 
      className="flex flex-col items-center justify-center my-3 mx-auto w-full max-w-full overflow-hidden p-1.5 bg-slate-900/40 dark:bg-slate-950/20 rounded-xl border border-slate-200/10 transition-all duration-300" 
      style={{ minHeight: scaledHeight + 24 }}
    >
      <span className="text-[8px] font-black tracking-widest text-slate-500 uppercase mb-1">
        Sponsored Ad — {label}
      </span>
      <div 
        className="flex items-center justify-center overflow-hidden mx-auto bg-slate-950/50 rounded-lg shadow-inner transition-all duration-300 relative"
        style={{ width: scaledWidth, height: scaledHeight }} 
      >
        <div 
          style={{
            width: finalWidth,
            height: finalHeight,
            transform: `scale(${scaleFactor})`,
            transformOrigin: 'top left',
            position: 'absolute',
            top: 0,
            left: 0,
          }}
        >
          <iframe
            title={`adsterra-ad-${finalKey}`}
            srcDoc={srcDoc}
            width={finalWidth}
            height={finalHeight}
            scrolling="no"
            style={{ border: 'none', overflow: 'hidden', width: finalWidth, height: finalHeight }}
          />
        </div>
      </div>
    </div>
  );
}

