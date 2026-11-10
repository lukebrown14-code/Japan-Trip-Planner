export type LandmarkKind = 'tokyo' | 'nikko' | 'takayama' | 'kyoto' | 'osaka' | 'hakone' | 'generic'
  | 'nara' | 'kanazawa' | 'nagoya' | 'kamakura' | 'hiroshima' | 'miyajima' | 'fukuoka' | 'sapporo';
export interface CityPreset { key: string; name: string; nameJa: string; lat: number; lng: number; landmark: LandmarkKind; station: string; dayTrips: { name: string; lat: number; lng: number; mode: 'train' | 'bus' }[] }
export const CITIES: Record<string, CityPreset> = {
  tokyo: { key: 'tokyo', name: 'Tokyo', nameJa: '東京', lat: 35.681, lng: 139.767, landmark: 'tokyo', station: 'tokyo', dayTrips: [] },
  nikko: { key: 'nikko', name: 'Nikko', nameJa: '日光', lat: 36.75, lng: 139.598, landmark: 'nikko', station: 'nikko', dayTrips: [{ name: 'Lake Chūzenji', lat: 36.74, lng: 139.5, mode: 'bus' }] },
  takayama: { key: 'takayama', name: 'Takayama', nameJa: '高山', lat: 36.14, lng: 137.252, landmark: 'takayama', station: 'takayama', dayTrips: [{ name: 'Shirakawa-go', lat: 36.257, lng: 136.906, mode: 'bus' }] },
  kyoto: { key: 'kyoto', name: 'Kyoto', nameJa: '京都', lat: 35.003, lng: 135.759, landmark: 'kyoto', station: 'kyoto', dayTrips: [] },
  osaka: { key: 'osaka', name: 'Osaka', nameJa: '大阪', lat: 34.703, lng: 135.497, landmark: 'osaka', station: 'osaka', dayTrips: [] },
  hakone: { key: 'hakone', name: 'Hakone', nameJa: '箱根', lat: 35.233, lng: 139.107, landmark: 'hakone', station: 'odawara', dayTrips: [] },
  nara: { key: 'nara', name: 'Nara', nameJa: '奈良', lat: 34.685, lng: 135.805, landmark: 'nara', station: 'nara', dayTrips: [] },
  kanazawa: { key: 'kanazawa', name: 'Kanazawa', nameJa: '金沢', lat: 36.578, lng: 136.648, landmark: 'kanazawa', station: 'kanazawa', dayTrips: [] },
  nagoya: { key: 'nagoya', name: 'Nagoya', nameJa: '名古屋', lat: 35.171, lng: 136.882, landmark: 'nagoya', station: 'nagoya', dayTrips: [] },
  kamakura: { key: 'kamakura', name: 'Kamakura', nameJa: '鎌倉', lat: 35.319, lng: 139.547, landmark: 'kamakura', station: 'kamakura', dayTrips: [] },
  hiroshima: { key: 'hiroshima', name: 'Hiroshima', nameJa: '広島', lat: 34.397, lng: 132.475, landmark: 'hiroshima', station: 'hiroshima', dayTrips: [] },
  miyajima: { key: 'miyajima', name: 'Miyajima', nameJa: '宮島', lat: 34.296, lng: 132.319, landmark: 'miyajima', station: 'miyajima', dayTrips: [] },
  fukuoka: { key: 'fukuoka', name: 'Fukuoka', nameJa: '福岡', lat: 33.59, lng: 130.42, landmark: 'fukuoka', station: 'fukuoka', dayTrips: [] },
  sapporo: { key: 'sapporo', name: 'Sapporo', nameJa: '札幌', lat: 43.069, lng: 141.351, landmark: 'sapporo', station: 'sapporo', dayTrips: [] },
};
export const AIRPORTS = { HND: { name: 'Haneda', lat: 35.549, lng: 139.78 }, NRT: { name: 'Narita', lat: 35.772, lng: 140.393 } };
