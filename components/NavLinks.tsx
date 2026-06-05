"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function NavLinks() {
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState(pathname);

  useEffect(() => {
    setActiveTab(pathname);
    
    // Listen for custom SPA navigation events from the Dashboard
    const handleSpaNav = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && customEvent.detail.tab) {
        setActiveTab(customEvent.detail.tab);
      }
    };
    window.addEventListener('spa-navigate', handleSpaNav);
    return () => window.removeEventListener('spa-navigate', handleSpaNav);
  }, [pathname]);

  return (
    <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
      <Link 
        href="/" 
        onClick={(e) => { 
          if (activeTab === '/processing') {
            e.preventDefault();
            window.dispatchEvent(new CustomEvent('request-cancel-processing', { detail: { target: '/' } }));
          } else {
            setActiveTab('/');
          }
        }}
        className={activeTab === '/' ? 'text-[#1ED760]' : 'text-zinc-400 hover:text-zinc-200 transition-colors'}
      >
        Dashboard
      </Link>
      <Link 
        href={activeTab === '/processing' ? '#' : '/processing'} 
        onClick={(e) => {
          if (activeTab === '/processing') {
            e.preventDefault(); // Already here, do nothing
          }
        }}
        className={activeTab === '/processing' ? 'text-[#1ED760]' : 'text-zinc-400 hover:text-zinc-200 transition-colors'}
      >
        Processing
      </Link>
      <Link 
        href={activeTab.startsWith('/results') ? '#' : '/results'} 
        onClick={(e) => {
          if (activeTab === '/processing') {
            e.preventDefault();
            window.dispatchEvent(new CustomEvent('request-cancel-processing', { detail: { target: '/results' } }));
          }
        }}
        className={activeTab.startsWith('/results') ? 'text-[#1ED760]' : 'text-zinc-400 hover:text-zinc-200 transition-colors'}
      >
        Save Results
      </Link>
      <span className="text-zinc-600 cursor-not-allowed" title="Coming soon">History</span>
      <span className="text-zinc-600 cursor-not-allowed" title="Coming soon">Settings</span>
    </nav>
  );
}
