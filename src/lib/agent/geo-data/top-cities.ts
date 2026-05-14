/**
 * Bundled top cities per country, used by the expander to promote the next
 * tier of zones when a workspace exhausts its current cells.
 *
 * This is a deliberately compact, curated subset (not the full GeoNames
 * cities500 dataset which is ~50MB) — enough for the markets our customers
 * target today. When a target country isn't in this list, the expander
 * falls back to "more queries" only.
 *
 * Coordinates are city centroids; population in thousands (rough).
 * Sorted by population descending.
 *
 * Pop is used to assign cell `priority` (1 for top 10, 2 for next 30, 3 for
 * the rest) and to pick the next batch on expansion.
 */

export interface TopCity {
  name: string
  lat: number
  lng: number
  pop_k: number
}

// Country code -> top cities (population desc).
// ISO-3166-1 alpha-2 codes.
export const TOP_CITIES: Record<string, readonly TopCity[]> = {
  FR: [
    { name: 'Paris',         lat: 48.8566, lng: 2.3522,  pop_k: 2102 },
    { name: 'Marseille',     lat: 43.2965, lng: 5.3698,  pop_k: 870  },
    { name: 'Lyon',          lat: 45.7640, lng: 4.8357,  pop_k: 522  },
    { name: 'Toulouse',      lat: 43.6047, lng: 1.4442,  pop_k: 493  },
    { name: 'Nice',          lat: 43.7102, lng: 7.2620,  pop_k: 342  },
    { name: 'Nantes',        lat: 47.2184, lng: -1.5536, pop_k: 320  },
    { name: 'Montpellier',   lat: 43.6108, lng: 3.8767,  pop_k: 295  },
    { name: 'Strasbourg',    lat: 48.5734, lng: 7.7521,  pop_k: 287  },
    { name: 'Bordeaux',      lat: 44.8378, lng: -0.5792, pop_k: 260  },
    { name: 'Lille',         lat: 50.6292, lng: 3.0573,  pop_k: 235  },
    { name: 'Rennes',        lat: 48.1173, lng: -1.6778, pop_k: 220  },
    { name: 'Reims',         lat: 49.2583, lng: 4.0317,  pop_k: 182  },
    { name: 'Le Havre',      lat: 49.4944, lng: 0.1079,  pop_k: 167  },
    { name: 'Saint-Étienne', lat: 45.4397, lng: 4.3872,  pop_k: 172  },
    { name: 'Toulon',        lat: 43.1242, lng: 5.9280,  pop_k: 176  },
    { name: 'Grenoble',      lat: 45.1885, lng: 5.7245,  pop_k: 158  },
    { name: 'Dijon',         lat: 47.3220, lng: 5.0415,  pop_k: 156  },
    { name: 'Angers',        lat: 47.4784, lng: -0.5632, pop_k: 154  },
    { name: 'Nîmes',         lat: 43.8367, lng: 4.3601,  pop_k: 151  },
    { name: 'Villeurbanne',  lat: 45.7665, lng: 4.8795,  pop_k: 149  },
    { name: 'Aix-en-Provence', lat: 43.5297, lng: 5.4474, pop_k: 143 },
    { name: 'Le Mans',       lat: 48.0061, lng: 0.1996,  pop_k: 144  },
    { name: 'Clermont-Ferrand', lat: 45.7772, lng: 3.0870, pop_k: 144 },
    { name: 'Brest',         lat: 48.3905, lng: -4.4860, pop_k: 139  },
    { name: 'Tours',         lat: 47.3941, lng: 0.6848,  pop_k: 136  },
    { name: 'Amiens',        lat: 49.8941, lng: 2.2958,  pop_k: 134  },
    { name: 'Limoges',       lat: 45.8336, lng: 1.2611,  pop_k: 130  },
    { name: 'Annecy',        lat: 45.8992, lng: 6.1294,  pop_k: 128  },
    { name: 'Cannes',        lat: 43.5528, lng: 7.0174,  pop_k: 74   },
    { name: 'Antibes',       lat: 43.5808, lng: 7.1239,  pop_k: 74   },
  ],
  US: [
    { name: 'New York',      lat: 40.7128, lng: -74.0060,  pop_k: 8336 },
    { name: 'Los Angeles',   lat: 34.0522, lng: -118.2437, pop_k: 3979 },
    { name: 'Chicago',       lat: 41.8781, lng: -87.6298,  pop_k: 2693 },
    { name: 'Houston',       lat: 29.7604, lng: -95.3698,  pop_k: 2320 },
    { name: 'Phoenix',       lat: 33.4484, lng: -112.0740, pop_k: 1680 },
    { name: 'Philadelphia',  lat: 39.9526, lng: -75.1652,  pop_k: 1584 },
    { name: 'San Antonio',   lat: 29.4241, lng: -98.4936,  pop_k: 1547 },
    { name: 'San Diego',     lat: 32.7157, lng: -117.1611, pop_k: 1424 },
    { name: 'Dallas',        lat: 32.7767, lng: -96.7970,  pop_k: 1343 },
    { name: 'San Jose',      lat: 37.3382, lng: -121.8863, pop_k: 1027 },
    { name: 'Austin',        lat: 30.2672, lng: -97.7431,  pop_k: 978  },
    { name: 'Jacksonville',  lat: 30.3322, lng: -81.6557,  pop_k: 911  },
    { name: 'Fort Worth',    lat: 32.7555, lng: -97.3308,  pop_k: 909  },
    { name: 'Columbus',      lat: 39.9612, lng: -82.9988,  pop_k: 898  },
    { name: 'Charlotte',     lat: 35.2271, lng: -80.8431,  pop_k: 885  },
    { name: 'San Francisco', lat: 37.7749, lng: -122.4194, pop_k: 881  },
    { name: 'Indianapolis',  lat: 39.7684, lng: -86.1581,  pop_k: 876  },
    { name: 'Seattle',       lat: 47.6062, lng: -122.3321, pop_k: 753  },
    { name: 'Denver',        lat: 39.7392, lng: -104.9903, pop_k: 727  },
    { name: 'Washington',    lat: 38.9072, lng: -77.0369,  pop_k: 705  },
    { name: 'Boston',        lat: 42.3601, lng: -71.0589,  pop_k: 692  },
    { name: 'Nashville',     lat: 36.1627, lng: -86.7816,  pop_k: 692  },
    { name: 'Portland',      lat: 45.5152, lng: -122.6784, pop_k: 654  },
    { name: 'Las Vegas',     lat: 36.1699, lng: -115.1398, pop_k: 651  },
    { name: 'Atlanta',       lat: 33.7490, lng: -84.3880,  pop_k: 498  },
    { name: 'Miami',         lat: 25.7617, lng: -80.1918,  pop_k: 467  },
    { name: 'Minneapolis',   lat: 44.9778, lng: -93.2650,  pop_k: 429  },
    { name: 'New Orleans',   lat: 29.9511, lng: -90.0715,  pop_k: 391  },
    { name: 'Pittsburgh',    lat: 40.4406, lng: -79.9959,  pop_k: 302  },
    { name: 'Cincinnati',    lat: 39.1031, lng: -84.5120,  pop_k: 302  },
  ],
  GB: [
    { name: 'London',     lat: 51.5074, lng: -0.1278,  pop_k: 9000 },
    { name: 'Birmingham', lat: 52.4862, lng: -1.8904,  pop_k: 1153 },
    { name: 'Manchester', lat: 53.4808, lng: -2.2426,  pop_k: 553  },
    { name: 'Leeds',      lat: 53.8008, lng: -1.5491,  pop_k: 793  },
    { name: 'Liverpool',  lat: 53.4084, lng: -2.9916,  pop_k: 498  },
    { name: 'Sheffield',  lat: 53.3811, lng: -1.4701,  pop_k: 584  },
    { name: 'Bristol',    lat: 51.4545, lng: -2.5879,  pop_k: 467  },
    { name: 'Glasgow',    lat: 55.8642, lng: -4.2518,  pop_k: 633  },
    { name: 'Edinburgh',  lat: 55.9533, lng: -3.1883,  pop_k: 526  },
    { name: 'Cardiff',    lat: 51.4816, lng: -3.1791,  pop_k: 362  },
    { name: 'Newcastle',  lat: 54.9783, lng: -1.6178,  pop_k: 300  },
    { name: 'Belfast',    lat: 54.5973, lng: -5.9301,  pop_k: 343  },
    { name: 'Nottingham', lat: 52.9548, lng: -1.1581,  pop_k: 330  },
    { name: 'Southampton',lat: 50.9097, lng: -1.4044,  pop_k: 269  },
    { name: 'Brighton',   lat: 50.8225, lng: -0.1372,  pop_k: 290  },
    { name: 'Cambridge',  lat: 52.2053, lng: 0.1218,   pop_k: 145  },
    { name: 'Oxford',     lat: 51.7520, lng: -1.2577,  pop_k: 152  },
    { name: 'Reading',    lat: 51.4543, lng: -0.9781,  pop_k: 318  },
    { name: 'Leicester',  lat: 52.6369, lng: -1.1398,  pop_k: 357  },
    { name: 'Coventry',   lat: 52.4068, lng: -1.5197,  pop_k: 369  },
  ],
  DE: [
    { name: 'Berlin',     lat: 52.5200, lng: 13.4050, pop_k: 3669 },
    { name: 'Hamburg',    lat: 53.5511, lng: 9.9937,  pop_k: 1899 },
    { name: 'Munich',     lat: 48.1351, lng: 11.5820, pop_k: 1488 },
    { name: 'Cologne',    lat: 50.9375, lng: 6.9603,  pop_k: 1086 },
    { name: 'Frankfurt',  lat: 50.1109, lng: 8.6821,  pop_k: 753  },
    { name: 'Stuttgart',  lat: 48.7758, lng: 9.1829,  pop_k: 635  },
    { name: 'Düsseldorf', lat: 51.2277, lng: 6.7735,  pop_k: 620  },
    { name: 'Leipzig',    lat: 51.3397, lng: 12.3731, pop_k: 597  },
    { name: 'Dortmund',   lat: 51.5136, lng: 7.4653,  pop_k: 588  },
    { name: 'Essen',      lat: 51.4556, lng: 7.0116,  pop_k: 583  },
    { name: 'Bremen',     lat: 53.0793, lng: 8.8017,  pop_k: 566  },
    { name: 'Dresden',    lat: 51.0504, lng: 13.7373, pop_k: 556  },
    { name: 'Hanover',    lat: 52.3759, lng: 9.7320,  pop_k: 532  },
    { name: 'Nuremberg',  lat: 49.4521, lng: 11.0767, pop_k: 518  },
  ],
  ES: [
    { name: 'Madrid',     lat: 40.4168, lng: -3.7038, pop_k: 3266 },
    { name: 'Barcelona',  lat: 41.3851, lng: 2.1734,  pop_k: 1620 },
    { name: 'Valencia',   lat: 39.4699, lng: -0.3763, pop_k: 800  },
    { name: 'Seville',    lat: 37.3891, lng: -5.9845, pop_k: 688  },
    { name: 'Zaragoza',   lat: 41.6488, lng: -0.8891, pop_k: 681  },
    { name: 'Málaga',     lat: 36.7213, lng: -4.4214, pop_k: 578  },
    { name: 'Murcia',     lat: 37.9922, lng: -1.1307, pop_k: 459  },
    { name: 'Palma',      lat: 39.5696, lng: 2.6502,  pop_k: 416  },
    { name: 'Las Palmas', lat: 28.1235, lng: -15.4366, pop_k: 379 },
    { name: 'Bilbao',     lat: 43.2630, lng: -2.9350, pop_k: 346  },
    { name: 'Alicante',   lat: 38.3452, lng: -0.4810, pop_k: 338  },
    { name: 'Córdoba',    lat: 37.8882, lng: -4.7794, pop_k: 325  },
  ],
  IT: [
    { name: 'Rome',     lat: 41.9028, lng: 12.4964, pop_k: 2873 },
    { name: 'Milan',    lat: 45.4642, lng: 9.1900,  pop_k: 1396 },
    { name: 'Naples',   lat: 40.8518, lng: 14.2681, pop_k: 967  },
    { name: 'Turin',    lat: 45.0703, lng: 7.6869,  pop_k: 870  },
    { name: 'Palermo',  lat: 38.1157, lng: 13.3615, pop_k: 668  },
    { name: 'Genoa',    lat: 44.4056, lng: 8.9463,  pop_k: 583  },
    { name: 'Bologna',  lat: 44.4949, lng: 11.3426, pop_k: 391  },
    { name: 'Florence', lat: 43.7696, lng: 11.2558, pop_k: 382  },
    { name: 'Bari',     lat: 41.1171, lng: 16.8719, pop_k: 320  },
    { name: 'Catania',  lat: 37.5079, lng: 15.0830, pop_k: 311  },
    { name: 'Venice',   lat: 45.4408, lng: 12.3155, pop_k: 261  },
    { name: 'Verona',   lat: 45.4384, lng: 10.9916, pop_k: 259  },
  ],
  CA: [
    { name: 'Toronto',   lat: 43.6532, lng: -79.3832,  pop_k: 2731 },
    { name: 'Montreal',  lat: 45.5017, lng: -73.5673,  pop_k: 1780 },
    { name: 'Calgary',   lat: 51.0447, lng: -114.0719, pop_k: 1306 },
    { name: 'Ottawa',    lat: 45.4215, lng: -75.6972,  pop_k: 994  },
    { name: 'Edmonton',  lat: 53.5461, lng: -113.4938, pop_k: 981  },
    { name: 'Vancouver', lat: 49.2827, lng: -123.1207, pop_k: 675  },
    { name: 'Winnipeg',  lat: 49.8951, lng: -97.1384,  pop_k: 749  },
    { name: 'Quebec',    lat: 46.8139, lng: -71.2080,  pop_k: 549  },
    { name: 'Hamilton',  lat: 43.2557, lng: -79.8711,  pop_k: 537  },
    { name: 'Halifax',   lat: 44.6488, lng: -63.5752,  pop_k: 403  },
  ],
  AU: [
    { name: 'Sydney',    lat: -33.8688, lng: 151.2093, pop_k: 5312 },
    { name: 'Melbourne', lat: -37.8136, lng: 144.9631, pop_k: 5078 },
    { name: 'Brisbane',  lat: -27.4698, lng: 153.0251, pop_k: 2462 },
    { name: 'Perth',     lat: -31.9505, lng: 115.8605, pop_k: 2059 },
    { name: 'Adelaide',  lat: -34.9285, lng: 138.6007, pop_k: 1345 },
    { name: 'Gold Coast',lat: -28.0167, lng: 153.4000, pop_k: 679  },
    { name: 'Newcastle', lat: -32.9283, lng: 151.7817, pop_k: 322  },
    { name: 'Canberra',  lat: -35.2809, lng: 149.1300, pop_k: 431  },
    { name: 'Hobart',    lat: -42.8821, lng: 147.3272, pop_k: 222  },
  ],
  BE: [
    { name: 'Brussels',  lat: 50.8503, lng: 4.3517, pop_k: 1211 },
    { name: 'Antwerp',   lat: 51.2194, lng: 4.4025, pop_k: 530  },
    { name: 'Ghent',     lat: 51.0543, lng: 3.7174, pop_k: 263  },
    { name: 'Charleroi', lat: 50.4108, lng: 4.4446, pop_k: 202  },
    { name: 'Liège',     lat: 50.6326, lng: 5.5797, pop_k: 197  },
  ],
  CH: [
    { name: 'Zurich',   lat: 47.3769, lng: 8.5417, pop_k: 415 },
    { name: 'Geneva',   lat: 46.2044, lng: 6.1432, pop_k: 203 },
    { name: 'Basel',    lat: 47.5596, lng: 7.5886, pop_k: 178 },
    { name: 'Lausanne', lat: 46.5197, lng: 6.6323, pop_k: 140 },
    { name: 'Bern',     lat: 46.9480, lng: 7.4474, pop_k: 134 },
  ],
  NL: [
    { name: 'Amsterdam', lat: 52.3676, lng: 4.9041, pop_k: 873  },
    { name: 'Rotterdam', lat: 51.9244, lng: 4.4777, pop_k: 651  },
    { name: 'The Hague', lat: 52.0705, lng: 4.3007, pop_k: 545  },
    { name: 'Utrecht',   lat: 52.0907, lng: 5.1214, pop_k: 358  },
    { name: 'Eindhoven', lat: 51.4416, lng: 5.4697, pop_k: 235  },
  ],
  PT: [
    { name: 'Lisbon',   lat: 38.7223, lng: -9.1393, pop_k: 545 },
    { name: 'Porto',    lat: 41.1579, lng: -8.6291, pop_k: 237 },
    { name: 'Braga',    lat: 41.5454, lng: -8.4265, pop_k: 137 },
    { name: 'Coimbra',  lat: 40.2033, lng: -8.4103, pop_k: 105 },
  ],
  IE: [
    { name: 'Dublin',    lat: 53.3498, lng: -6.2603, pop_k: 592 },
    { name: 'Cork',      lat: 51.8985, lng: -8.4756, pop_k: 210 },
    { name: 'Galway',    lat: 53.2707, lng: -9.0568, pop_k: 80  },
    { name: 'Limerick',  lat: 52.6638, lng: -8.6267, pop_k: 95  },
  ],
}

/**
 * Find the country code for a given lat/lng using a coarse bounding-box
 * heuristic. Returns null if not in our bundled set. Cheap, no IO.
 */
const COUNTRY_BBOX: Record<string, [number, number, number, number]> = {
  // [south, west, north, east]
  FR: [41.3, -5.5, 51.1, 9.7],
  US: [24.4, -125.0, 49.4, -66.9],
  GB: [49.9, -8.6, 60.9, 1.8],
  DE: [47.3, 5.9, 55.0, 15.0],
  ES: [27.6, -18.2, 43.8, 4.3],   // includes Canary Islands
  IT: [35.5, 6.6, 47.1, 18.5],
  CA: [41.7, -141.0, 83.1, -52.6],
  AU: [-43.7, 112.9, -10.7, 153.6],
  BE: [49.5, 2.5, 51.5, 6.4],
  CH: [45.8, 5.9, 47.8, 10.5],
  NL: [50.7, 3.3, 53.6, 7.2],
  PT: [36.9, -9.5, 42.2, -6.2],
  IE: [51.4, -10.5, 55.4, -5.4],
}

export function inferCountryFromLatLng(lat: number, lng: number): string | null {
  for (const [code, [s, w, n, e]] of Object.entries(COUNTRY_BBOX)) {
    if (lat >= s && lat <= n && lng >= w && lng <= e) return code
  }
  return null
}

/**
 * Map a country code to a sensible default timezone. Used at onboarding so
 * the digest fires at the user's local 8am.
 */
const COUNTRY_TIMEZONE: Record<string, string> = {
  FR: 'Europe/Paris',
  US: 'America/New_York',  // approximation; could refine by state lat
  GB: 'Europe/London',
  DE: 'Europe/Berlin',
  ES: 'Europe/Madrid',
  IT: 'Europe/Rome',
  CA: 'America/Toronto',
  AU: 'Australia/Sydney',
  BE: 'Europe/Brussels',
  CH: 'Europe/Zurich',
  NL: 'Europe/Amsterdam',
  PT: 'Europe/Lisbon',
  IE: 'Europe/Dublin',
}

export function timezoneForCountry(code: string | null | undefined): string {
  if (!code) return 'UTC'
  return COUNTRY_TIMEZONE[code.toUpperCase()] ?? 'UTC'
}

/**
 * Returns the top N cities for a country code, sorted by population desc.
 * Pass N to pick a tier: 10 = Tier 1 (metros), 30 = Tier 2, etc.
 */
export function topCitiesForCountry(code: string, n: number): readonly TopCity[] {
  const upper = code.toUpperCase()
  const list = TOP_CITIES[upper]
  if (!list) return []
  return list.slice(0, n)
}
