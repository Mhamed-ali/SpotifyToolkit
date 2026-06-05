export function AppLogo({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Left Circle - Slate Blue/Charcoal (contrasts with the black navbar) */}
      <circle cx="40" cy="50" r="35" fill="#1e293b" />
      
      {/* Right Circle - Spotify Green with opacity for the Venn intersection effect */}
      <circle cx="60" cy="50" r="35" fill="#1ED760" fillOpacity="0.8" />
      
      {/* Horizontal Waveform Line (Split colors at center) */}
      <rect x="15" y="48.5" width="35" height="3" rx="1.5" fill="#1ED760" />
      <rect x="50" y="48.5" width="35" height="3" rx="1.5" fill="#1e293b" />

      {/* Left Waveform Bars (Green on Dark) */}
      <rect x="22" y="46" width="4" height="8" rx="2" fill="#1ED760" />
      <rect x="30" y="40" width="4" height="20" rx="2" fill="#1ED760" />
      <rect x="38" y="30" width="4" height="40" rx="2" fill="#1ED760" />
      
      {/* Middle Waveform Bars */}
      <rect x="46" y="20" width="4" height="60" rx="2" fill="#1ED760" />
      <rect x="54" y="25" width="4" height="50" rx="2" fill="#1e293b" />
      
      {/* Right Waveform Bars (Dark on Green) */}
      <rect x="62" y="30" width="4" height="40" rx="2" fill="#1e293b" />
      <rect x="70" y="40" width="4" height="20" rx="2" fill="#1e293b" />
      <rect x="78" y="46" width="4" height="8" rx="2" fill="#1e293b" />
    </svg>
  );
}
