/**
 * Single-Responsibility Service for Multi-Tier Arabic Track Detection:
 * 1. Extended Arabic Unicode Script (\u0600-\u06FF, \u0750-\u077F, \u08A0-\u08FF, \uFB50-\uFDFF, \uFE70-\uFEFF)
 * 2. Transliterated Franco-Arabic & Cultural Keywords (word-boundary matched)
 * 3. Known Arabic Artists Directory (English regex + Arabic script + Strict Artist Name Matches)
 * 4. Artist Genre Analysis (ARABIC_GENRE_KEYWORDS for Spotify artist genres when not in strictMode)
 */

const ARABIC_UNICODE_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

const ARABIC_KEYWORDS = [
    "Habibi", "Hayati", "Arabic", "Arab", "Middle East", "MENA", "Orient", "Shaabi", "Tarab",
    "Dabke", "Mahraganat", "Mawal", "Khaleeji", "Andalusian", "Baladi", "Mizmar",
    "Khaliji", "Maghreb", "Layali", "Gharam", "Ashqan", "Hob", "Albi", "Ahlan", "Ya Leil",
    "Omri", "Fi Hagat", "Yaba", "Yamma", "Yallah", "Bint", "Rouh", "Samra", "Sahar",
    "Ahwak", "Enta", "Shams", "Zaman", "Hiya", "Warda", "3liya", "Habaytak"
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
    "abdel karim al kabli", "sharhabil ahmed", "legecy", "ma3iz", "amir eid", "daboor"
];

const KNOWN_ARABIC_ARTISTS_ARABIC_SCRIPT = [
    "كايروكي", "شارموفرز", "ويجز", "زاب ثروت", "أنغام", "مروان بابلو", "شاهين", "العسيلي",
    "حمزة نمرة", "غالية", "رشا رزق", "عمرو دياب", "محمد منير", "تامر حسني", "شيرين", "حمو بيكا",
    "عبد الحليم حافظ", "أم كلثوم", "حكيم", "حماقي", "مصطفى قمر", "هشام عباس", "إيهاب توفيق",
    "فيروز", "إليسا", "نانسي عجرم", "هيفاء وهبي", "وائل كفوري", "فارس كرم", "كارول سماحة",
    "ماجدة الرومي", "راغب علامة", "ملحم زين", "ميريام فارس", "جوزيف عطية", "عاصي الحلاني",
    "جوليا بطرس", "زياد الرحباني", "مروان خوري", "صابر الرباعي", "أصالة نصري", "جورج وسوف",
    "سميرة توفيق", "عمر سليمان", "فايا يونان", "بلقيس", "إبراهيم تاتليس", "كاظم الساهر",
    "سيف نبيل", "حاتم العراقي", "رحمة رياض", "ماجد المهندس", "الشاب خالد", "الشاب مامي",
    "الشاب حسني", "زينة الداودية", "سعد لمجرد", "دوزي", "فناير", "بلطي", "لارتيست", "سولكينغ",
    "سميرة سعيد", "لطيفة", "أحلام", "راشد الماجد", "حسين الجسمي", "طلال مداح", "نوال الكويتية",
    "ليجي-سي", "ليجي سي", "ماعيز", "روبي", "ساندي", "دينا", "مسلم", "نور", "احمد كامل",
    "أحمد كامل", "جدل", "أحمد سعد", "احمد سعد", "ميمز", "مميز"
];

export const ARABIC_GENRE_KEYWORDS = [
    "arab", "egyptian", "shabi", "mahraganat", "khaliji", "rai",
    "levantine", "lebanese", "maghreb", "moroccan", "iraqi",
    "syrian", "gulf", "khaleeji", "dabke", "oriental", "middle eastern",
    "mena", "tarab", "chaabi", "shaabi", "gnawa", "bedouin"
];

// Strict Artists: Only match if the exact artist name appears in the track's artist list
const STRICT_ARABIC_ARTISTS = new Set(["ruby", "sandy", "dina", "muslim", "nour"]);

export class ArabicDetector {
    static getMatchReasonInText(text, fieldLabel = 'Text', { checkArabicScript = true } = {}) {
        if (!text) return null;

        if (checkArabicScript && ARABIC_UNICODE_REGEX.test(text)) {
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

        for (const arabicName of KNOWN_ARABIC_ARTISTS_ARABIC_SCRIPT) {
            if (text.includes(arabicName)) {
                return `Known Artist: ${arabicName}`;
            }
        }

        return null;
    }

    static detectByGenres(genres = [], strictMode = false) {
        if (strictMode || !Array.isArray(genres) || genres.length === 0) return null;

        for (const genre of genres) {
            if (!genre || typeof genre !== 'string') continue;
            const lower = genre.toLowerCase();
            for (const keyword of ARABIC_GENRE_KEYWORDS) {
                if (lower.includes(keyword)) {
                    return `Genre Match ("${genre}")`;
                }
            }
        }
        return null;
    }

    static detectTrack(trackObj, { strictMode = false, artistGenres = [] } = {}) {
        const t = trackObj?.track || trackObj;
        if (!t) return null;

        // 1. Check Track Title
        const titleMatch = ArabicDetector.getMatchReasonInText(t.name, 'Title');
        if (titleMatch) return titleMatch;

        // 2. Check Artists (Strict + Broad)
        if (Array.isArray(t.artists)) {
            for (const artist of t.artists) {
                const name = artist?.name || '';
                if (name.includes('فنانون متنوعون') || name.toLowerCase().includes('various artists')) {
                    continue;
                }
                if (STRICT_ARABIC_ARTISTS.has(name.toLowerCase())) {
                    return `Known Artist: ${name}`;
                }
                const artistMatch = ArabicDetector.getMatchReasonInText(name, 'Artist', {
                    checkArabicScript: !strictMode
                });
                if (artistMatch) return artistMatch;
            }
        }

        // 3. Check Album Name (only in Standard mode)
        if (!strictMode) {
            const albumMatch = ArabicDetector.getMatchReasonInText(t.album?.name, 'Album');
            if (albumMatch) return albumMatch;
        }

        // 4. Check Artist Genres (Pass 3 Genre Analysis when available and not in strictMode)
        if (!strictMode && artistGenres && artistGenres.length > 0) {
            const genreMatch = ArabicDetector.detectByGenres(artistGenres, strictMode);
            if (genreMatch) return genreMatch;
        }

        return null;
    }
}
