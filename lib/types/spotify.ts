export interface TokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in: number;
  refresh_token?: string;
  error?: string;
  error_description?: string;
}

export interface SpotifyImage {
  url: string;
  height: number | null;
  width: number | null;
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  images: SpotifyImage[];
  tracks: {
    total: number;
    href: string;
  };
  owner: {
    display_name: string;
    id: string;
  };
  external_urls: {
    spotify: string;
  };
}

export interface SpotifyPlaylistsResponse {
  items: SpotifyPlaylist[];
  total: number;
  limit: number;
  offset: number;
  next: string | null;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  duration_ms: number;
  artists: {
    id: string;
    name: string;
  }[];
  album?: {
    id: string;
    name: string;
    images: SpotifyImage[];
  };
  external_urls?: {
    spotify: string;
  };
}

export interface SpotifyUserProfile {
  id: string;
  display_name: string;
  images: SpotifyImage[];
  email?: string;
  product?: string;
}
