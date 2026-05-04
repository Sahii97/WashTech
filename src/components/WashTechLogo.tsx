import React from 'react';

export function WashTechLogo({ className = "w-6 h-6", white = true }: { className?: string; white?: boolean }) {
  // Uses an SVG mask to create transparent cutouts in the blue drop,
  // or uses white fill for the drop if the background is dark.
  
  const dropColor = white ? "#FFFFFF" : "#007AFF";
  const textColor = white ? "#FFFFFF" : "#0050B3";
  
  return (
    <svg 
      viewBox="0 0 100 130" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <mask id="drop-cutout">
          {/* Everything white is kept, everything black is cut out */}
          <rect width="100" height="130" fill="white" />
          
          {/* Wave Path (Black = Cutout) */}
          <path 
            d="M 12 55 C 25 35, 35 35, 45 60 L 55 60 L 82 35" 
            stroke="black" 
            strokeWidth="8" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
          />
          {/* Straight line down to left */}
          <path 
            d="M 50 60 L 35 85" 
            stroke="black" 
            strokeWidth="8" 
            strokeLinecap="round" 
          />
          {/* Ring */}
          <circle cx="30" cy="90" r="10" fill="black" />
          <circle cx="30" cy="90" r="4" fill="white" />
        </mask>
      </defs>
      
      {/* Water Drop Shape */}
      <path 
        d="M50 5C50 5 15 45 15 75C15 94.33 30.67 110 50 110C69.33 110 85 94.33 85 75C85 45 50 5 50 5Z" 
        fill={dropColor} 
        mask="url(#drop-cutout)"
      />
    </svg>
  );
}
