"use client";

import { clientLogger } from "@/lib/utils/clientLogger";

export default function LogoutButton() {
  const handleLogout = () => {
    clientLogger.info('User initiated logout');
    // Give the log a few milliseconds to fire off to the backend
    setTimeout(() => {
      window.location.href = "/api/auth/logout";
    }, 50);
  };

  return (
    <button 
      onClick={handleLogout}
      title="Log out"
      className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-colors"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
      </svg>
    </button>
  );
}
