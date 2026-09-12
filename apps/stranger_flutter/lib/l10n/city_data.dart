/// Curated city ids known to this dev build, used for the "type a city, get
/// suggestions" autocomplete on both the publish form's city field and City
/// interests' add-city field. Not an enforced allow-list — cityId is still free text
/// server-side (no city registry exists yet) — purely a UX convenience.
const List<String> knownCityIds = [
  'mumbai',
  'delhi',
  'bangalore',
  'chennai',
  'hyderabad',
  'pune',
  'kolkata',
  'dubai',
  'frankfurt',
  'mainz',
  'berlin',
  'munich',
  'london',
  'paris',
  'newyork',
  'losangeles',
  'chicago',
  'tokyo',
  'osaka',
  'singapore',
];

/// Each city's own visual identity — a landmark distinctive enough to recognize the
/// city by, in place of one generic building icon for every row. Kept intentionally
/// short: a real (if imperfect) match beats guessing one for every city in
/// [knownCityIds], so anything not listed here falls back to a plain cityscape.
const Map<String, String> _cityLandmarkEmoji = {
  'mumbai':
      '🌉', // Bandra-Worli Sea Link — closest available stand-in for the Gateway of India
  'delhi': '🏰', // Red Fort
  'newdelhi': '🏰',
  'dubai': '🏙️', // Burj Khalifa / skyline
  'frankfurt': '🏢', // Messeturm and the rest of its skyline
  'mainz': '⛪', // Mainz Cathedral
  'berlin': '🏛️', // Brandenburg Gate
  'newyork': '🗽', // Statue of Liberty
  'tokyo': '🗼', // Tokyo Tower
};

const String _defaultCityEmoji = '🏙️';

String cityEmoji(String cityId) =>
    _cityLandmarkEmoji[cityId.trim().toLowerCase()] ?? _defaultCityEmoji;
