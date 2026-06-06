/**
 * Utility functions for detecting Arabic tracks.
 */

// Regex matches Arabic letters, numbers, and common diacritics
// Unicode block \u0600-\u06FF covers standard Arabic
// \u0750-\u077F covers Arabic Supplement
// \u08A0-\u08FF covers Arabic Extended-A
const ARABIC_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

const ARABIC_GENRE_KEYWORDS = [
  'arab', 'egyptian', 'shabi', 'mahraganat', 'khaliji', 'rai', 
  'levantine', 'lebanese', 'maghreb', 'moroccan', 'iraqi', 
  'syrian', 'gulf', 'khaleeji', 'dabke', 'oriental', 'middle eastern',
  'mena', 'tarab', 'chaabi', 'shaabi', 'gnawa', 'bedouin'
];

const FRANCO_ARABIC_REGEX = /\b(habibi|hayati|albi|omri|fi hagat|yaba|yamma|yallah|mawal|andalusian|baladi|mizmar|maghreb|layali|gharam|ashqan|hob|ahlan|ya leil|bint|rouh|samra|sahar|ahwak|enta|shams|zaman)\b/i;

const KNOWN_ARABIC_ARTISTS_REGEX = /\b(cairokee|sharmoofers|wegz|zap tharwat|angham|marwan pablo|shahyn|esseily|hamza namira|ghaliaa|racha rizk|amr diab|mohamed mounir|tamer hosny|sherine|hamo bika|abdel halim hafez|umm kulthum|hakim|hamaki|mostafa amar|hisham abbas|ehab tawfik|fairuz|elissa|nancy ajram|haifa wehbe|wael kfoury|fares karam|carole samaha|majida el roumi|ragheb alama|melhem zein|myriam fares|joseph attieh|assi el hallani|julia boutros|ziad rahbani|marwan khoury|saber rebai|assala nasri|george wassouf|samira tawfik|omar souleyman|faia younan|balqees|ibrahim tatlises|kazem al saher|saif nabeel|hatem al iraqi|rahma riad|majid al mohandis|cheb khaled|cheb mami|cheb hasni|zina daoudia|saad lamjarred|douzi|fnaire|balti|l'artiste|soolking|samira said|latifa|ahlam|rashed al majed|hussain al jassmi|talal maddah|nawal el kuwaitia|legecy|ma3iz|ruby|sandy|dina|muslim|nour)\b/i;

/**
 * Fast Check: Detects Arabic tracks purely by analyzing the characters 
 * in the track title and artist names.
 */
export function isArabicByRegex(track: any): { match: boolean; matchedString?: string } {
  if (!track) return { match: false };
  
  if (track.name) {
    const match = track.name.match(ARABIC_REGEX);
    if (match) return { match: true, matchedString: match[0] };
    
    const francoMatch = track.name.match(FRANCO_ARABIC_REGEX);
    if (francoMatch) return { match: true, matchedString: francoMatch[0] };
  }
  
  if (track.artists && Array.isArray(track.artists)) {
    for (const artist of track.artists) {
      if (artist.name) {
        const match = artist.name.match(ARABIC_REGEX);
        if (match) return { match: true, matchedString: match[0] };

        const artistMatch = artist.name.match(KNOWN_ARABIC_ARTISTS_REGEX);
        if (artistMatch) return { match: true, matchedString: `Known Artist: ${artistMatch[0]}` };
      }
    }
  }
  
  return { match: false };
}

/**
 * Deep Check: Detects Arabic tracks by analyzing the Spotify genres associated
 * with the track's artists. Useful for Franco-Arabic or English-titled Arabic songs.
 */
export function isArabicByGenre(genres: string[]): { match: boolean; matchedString?: string } {
  if (!genres || !Array.isArray(genres) || genres.length === 0) return { match: false };
  
  for (const genre of genres) {
    const lowerGenre = genre.toLowerCase();
    for (const keyword of ARABIC_GENRE_KEYWORDS) {
      if (lowerGenre.includes(keyword)) {
        return { match: true, matchedString: genre };
      }
    }
  }
  
  return { match: false };
}
