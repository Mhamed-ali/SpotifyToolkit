/**
 * Single-Responsibility Service for 3-tier Arabic Track Detection:
 * 1. Arabic Unicode Script (\u0600-\u06FF)
 * 2. Transliterated Cultural Keywords (word-boundary matched)
 * 3. Known Arabic Artists Directory + Strict Artist Name Matches
 */

const ARABIC_UNICODE_REGEX = /[\u0600-\u06FF]/;

const ARABIC_KEYWORDS = [
    "Habibi", "Arabic", "Arab", "Middle East", "MENA", "Orient", "Shaabi", "Tarab",
    "Dabke", "Mahraganat", "Mawal", "Khaleeji", "Andalusian", "Baladi", "Mizmar",
    "Khaliji", "Maghreb", "Layali", "Gharam", "Ashqan", "Hob", "Albi", "Ahlan", "Ya Leil",
    "Omri", "Bint", "Rouh", "Samra", "Sahar", "Ahwak", "Enta", "Shams", "Zaman"
];

const KNOWN_ARABIC_ARTISTS = [
    "cairokee", "sharmoofers", "ahmed", "saad", "mohammed", "saeed", "wegz", "zap", "tharwat", "perrie",
    "angham", "marwan", "pablo", "kamel", "shahyn", "mozmin", "laboudi", "sary", "hany", "telecom",
    "egypt", "mekky", "dina", "wedidi", "muslim", "zena", "emad", "chemix", "dartro", "mahmoud",
    "esseily", "hamza", "namira", "ghaliaa", "samer", "doumet", "eljoee", "chaama", "racha", "rizk",
    "ghizlane", "melih", "lubany", "amr diab", "mohamed mounir", "tamer hosny", "sherine", "hamo bika",
    "abdel halim hafez", "umm kulthum", "hakim", "ramadan", "hamaki", "mahragan", "sandy", "mostafa amar",
    "hisham abbas", "ehab tawfik", "fairuz", "elissa", "nancy ajram", "haifa wehbe", "wael kfoury", "fares karam",
    "carole samaha", "majida el roumi", "ragheb alama", "melhem zein", "myriam fares", "joseph attieh",
    "assi el hallani", "julia boutros", "ziad rahbani", "marwan khoury", "saber rebai", "assala nasri",
    "george wassouf", "samira tawfik", "omar souleyman", "faia younan", "balqees", "ibrahim tatlises",
    "sahar taha", "lena chamamyan", "fayrouz karawya", "kazem al saher", "saif nabeel", "hatem al iraqi",
    "rahma riad", "majid al mohandis", "ali jassim", "mohammed al salim", "aseel hameem", "hossam al rassam",
    "cheb khaled", "cheb mami", "cheb hasni", "zina daoudia", "saad lamjarred", "douzi", "fnaire", "balti",
    "l'artiste", "soolking", "hamid bouchnak", "reda taliani", "faudel", "samira said", "latifa", "amina",
    "abdul majeed abdullah", "ahlam", "rashed al majed", "hussain al jassmi", "talal maddah", "nawal el kuwaitia",
    "dalia mubarak", "shamma hamdan", "ayed", "omar al-abdallat", "diana karazon", "zade dirani", "mohamed wardi",
    "abdel karim al kabli", "sharhabil ahmed", "legecy", "ma3iz"
];

// Strict Artists: Only match if the exact artist name appears in the track's artist list
const STRICT_ARABIC_ARTISTS = new Set(["ruby", "sandy", "dina", "muslim", "nour"]);

export class ArabicDetector {
    static getMatchReasonInText(text, fieldLabel = 'Text') {
        if (!text) return null;

        if (ARABIC_UNICODE_REGEX.test(text)) {
            return `Arabic Script in ${fieldLabel}`;
        }

        const matchedKeyword = ARABIC_KEYWORDS.find(keyword =>
            new RegExp(`\\b${keyword}\\b`, 'i').test(text)
        );
        if (matchedKeyword) {
            return `Keyword: ${matchedKeyword} (${fieldLabel})`;
        }

        const matchedArtist = KNOWN_ARABIC_ARTISTS.find(artist =>
            new RegExp(`\\b${artist}\\b`, 'i').test(text)
        );
        if (matchedArtist) {
            return `Artist Match: ${matchedArtist} (in ${fieldLabel})`;
        }

        return null;
    }

    static detectTrack(trackObj) {
        const t = trackObj?.track || trackObj;
        if (!t) return null;

        // 1. Check Track Title
        const titleMatch = ArabicDetector.getMatchReasonInText(t.name, 'Title');
        if (titleMatch) return titleMatch;

        // 2. Check Artists (Strict + Broad)
        if (Array.isArray(t.artists)) {
            for (const artist of t.artists) {
                const name = artist?.name || '';
                if (STRICT_ARABIC_ARTISTS.has(name.toLowerCase())) {
                    return `Known Artist: ${name}`;
                }
                const artistMatch = ArabicDetector.getMatchReasonInText(name, 'Artist');
                if (artistMatch) return artistMatch;
            }
        }

        // 3. Check Album Name
        const albumMatch = ArabicDetector.getMatchReasonInText(t.album?.name, 'Album');
        if (albumMatch) return albumMatch;

        return null;
    }
}
