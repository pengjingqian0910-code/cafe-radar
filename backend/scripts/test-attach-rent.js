import { calculateRentScore } from '../services/scoreCalculator.js';

// Simulated shops (from nov_2024.shops)
const shops = [
  { station: '中山站', rent: 1614.82 },
  { station: '中山站', rent: 1700 },
  { station: '中山站', rent: 1500 },
  { station: '其他站', rent: 3000 }
];

// Simulated sites (rows from main_analysis)
const sites = [
  { mrt_station: '中山站', optimal_score: 80 },
  { mrt_station: '其他站', optimal_score: 60 },
  { mrt_station: '沒有店家的站', optimal_score: 50 }
];

// Build station rents map
const stationRents = new Map();
for (const s of shops) {
  if (!s.station) continue;
  const r = s.rent !== null && s.rent !== undefined ? Number(s.rent) : null;
  if (r === null || Number.isNaN(r)) continue;
  if (!stationRents.has(s.station)) stationRents.set(s.station, []);
  stationRents.get(s.station).push(r);
}

const median = arr => {
  arr.sort((a, b) => a - b);
  const m = Math.floor(arr.length / 2);
  return (arr.length % 2 === 1) ? arr[m] : (arr[m - 1] + arr[m]) / 2;
};

const processedSites = sites.map(site => {
  const rents = stationRents.get(site.mrt_station) || [];
  const rentVal = rents.length ? median(rents) : null;
  return {
    ...site,
    rent: rentVal !== null ? Number(rentVal) : null,
    rent_score: rentVal !== null ? calculateRentScore(rentVal) : null,
    rent_source: rents.length ? 'station_median' : null
  };
});

console.log('Shops:', shops);
console.log('Processed Sites:');
console.log(JSON.stringify(processedSites, null, 2));
