import { useEffect, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';

function Map({ sites, stations, shops, selectedSite, onSiteClick }) {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [markers, setMarkers] = useState({
    stations: [],
    zones: []
  });
  const [shopMarkers, setShopMarkers] = useState([]);
  const [showShops, setShowShops] = useState(false);

  // 初始化地圖
  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    
    if (!apiKey) {
      console.error('Google Maps API Key 未設定');
      return;
    }

    const loader = new Loader({
      apiKey: apiKey,
      version: 'weekly',
    });

    loader.load().then(() => {
      const mapInstance = new google.maps.Map(mapRef.current, {
        center: { lat: 25.0478, lng: 121.5318 },
        zoom: 13,
        mapTypeId: 'roadmap',
        mapTypeControl: true,
        streetViewControl: true,
        fullscreenControl: true,
      });

      setMap(mapInstance);
    }).catch(error => {
      console.error('Google Maps 載入失敗:', error);
    });
  }, []);

  // 更新捷運站標記（莫蘭迪色系）
  useEffect(() => {
    if (!map || !stations) return;

    markers.stations.forEach(marker => marker.setMap(null));

    const newMarkers = stations.map(station => {
      const marker = new google.maps.Marker({
        position: { 
          lat: parseFloat(station.lat), 
          lng: parseFloat(station.lon) 
        },
        map: map,
        title: station.station_name || station.name,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg width="32" height="32" xmlns="http://www.w3.org/2000/svg">
              <circle cx="16" cy="16" r="14" fill="#afc5cc" stroke="white" stroke-width="3"/>
              <text x="16" y="21" text-anchor="middle" fill="white" font-size="16" font-weight="bold">M</text>
            </svg>
          `),
          scaledSize: new google.maps.Size(32, 32),
          anchor: new google.maps.Point(16, 16),
        },
        zIndex: 1000,
      });

      const infoWindow = new google.maps.InfoWindow({
        content: createStationInfoWindow(station),
      });

      marker.addListener('click', () => {
        infoWindow.open(map, marker);
      });

      return marker;
    });

    setMarkers(prev => ({ ...prev, stations: newMarkers }));
  }, [map, stations]);

  // 更新區間圓圈（莫蘭迪色系）
  useEffect(() => {
    if (!map || !sites || !stations) return;

    markers.zones.forEach(circle => circle.setMap(null));

    const sitesByStation = groupSitesByStation(sites, stations);
    const newZones = [];

    Object.entries(sitesByStation).forEach(([stationName, stationData]) => {
      const { lat, lng, zones } = stationData;

      zones.forEach(zone => {
        const circle = new google.maps.Circle({
          strokeColor: getZoneColor(zone.score),
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: getZoneColor(zone.score),
          fillOpacity: 0.25,
          map: map,
          center: { lat, lng },
          radius: zone.endRadius,
          clickable: true,
          zIndex: 100 - zone.startRadius,
        });

        circle.addListener('click', () => {
          onSiteClick(zone.site);
        });

        const infoWindow = new google.maps.InfoWindow();
        
        circle.addListener('mouseover', (e) => {
          infoWindow.setContent(createZoneInfoWindow(zone));
          infoWindow.setPosition(e.latLng);
          infoWindow.open(map);
        });

        circle.addListener('mouseout', () => {
          infoWindow.close();
        });

        newZones.push(circle);
      });
    });

    setMarkers(prev => ({ ...prev, zones: newZones }));

    if (stations.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      stations.forEach(station => {
        bounds.extend({ lat: parseFloat(station.lat), lng: parseFloat(station.lon) });
      });
      map.fitBounds(bounds);
    }
  }, [map, sites, stations]);

  // 🔥 核心修改：只顯示篩選區間內的店家
  useEffect(() => {
    if (!map || !shops) return;

    // 清除舊標記
    shopMarkers.forEach(marker => marker.setMap(null));

    if (!showShops || !sites || sites.length === 0) {
      setShopMarkers([]);
      return;
    }

    // 🎯 篩選：只顯示在當前 sites 區間範圍內的店家
    const filteredShops = filterShopsInSiteZones(shops, sites, stations);

    console.log(`📍 顯示店家: ${filteredShops.length}/${shops.length} 家（僅篩選區間內）`);

    // 建立新標記（莫蘭迪色系）
    const newMarkers = filteredShops.map(shop => {
      const marker = new google.maps.Marker({
        position: { 
          lat: parseFloat(shop.lat), 
          lng: parseFloat(shop.lon) 
        },
        map: map,
        title: shop.name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 5,
          fillColor: getShopColorMorandi(shop.type),
          fillOpacity: 0.7,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
        zIndex: 10,
      });

      const infoWindow = new google.maps.InfoWindow({
        content: createShopInfoWindow(shop),
      });

      marker.addListener('click', () => {
        infoWindow.open(map, marker);
      });

      return marker;
    });

    setShopMarkers(newMarkers);
  }, [map, shops, showShops, sites, stations]);

  // 高亮選中的區間
  useEffect(() => {
    if (!selectedSite || !map || !stations) return;

    const station = stations.find(s => 
      (s.station_name || s.name) === selectedSite.mrt_station
    );

    if (station) {
      map.panTo({ 
        lat: parseFloat(station.lat), 
        lng: parseFloat(station.lon) 
      });
      map.setZoom(15);
    }

    markers.zones.forEach(circle => {
      const center = circle.getCenter();
      const radius = circle.getRadius();
      
      if (station && 
          Math.abs(center.lat() - parseFloat(station.lat)) < 0.0001 &&
          Math.abs(center.lng() - parseFloat(station.lon)) < 0.0001) {
        
        const zone = getZoneFromRadius(radius);
        if (zone === selectedSite.zone_label) {
          circle.setOptions({
            fillOpacity: 0.45,
            strokeWeight: 4,
            strokeOpacity: 1,
          });
        } else {
          circle.setOptions({
            fillOpacity: 0.25,
            strokeWeight: 2,
            strokeOpacity: 0.8,
          });
        }
      }
    });
  }, [selectedSite, map, markers.zones, stations]);

  // ========================================
  // 🆕 核心函數：篩選區間內的店家
  // ========================================

  function filterShopsInSiteZones(shops, sites, stations) {
    if (!shops || !sites || !stations) return [];

    const filteredShops = [];

    sites.forEach(site => {
      // 找到對應的捷運站
      const station = stations.find(s => 
        (s.station_name || s.name) === site.mrt_station
      );

      if (!station) return;

      const stationLat = parseFloat(station.lat);
      const stationLng = parseFloat(station.lon);

      // 解析區間範圍
      const zoneMatch = site.zone_label.match(/(\d+)-(\d+)m?/);
      if (!zoneMatch) return;

      const startRadius = parseInt(zoneMatch[1]);
      const endRadius = parseInt(zoneMatch[2]);

      // 篩選在這個區間內的店家
      shops.forEach(shop => {
        const shopLat = parseFloat(shop.lat);
        const shopLng = parseFloat(shop.lon);

        // 計算距離（公尺）
        const distance = calculateDistance(stationLat, stationLng, shopLat, shopLng);

        // 在區間範圍內 + 避免重複
        if (distance >= startRadius && distance <= endRadius) {
          // 避免重複加入
          if (!filteredShops.find(s => s.lat === shop.lat && s.lon === shop.lon)) {
            filteredShops.push(shop);
          }
        }
      });
    });

    return filteredShops;
  }

  // 計算兩點距離（Haversine 公式）
  function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // 地球半徑（公尺）
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return distance;
  }

  // ========================================
  // 輔助函數
  // ========================================

  function groupSitesByStation(sites, stations) {
    const grouped = {};

    sites.forEach(site => {
      const stationName = site.mrt_station;
      
      const station = stations.find(s => 
        (s.station_name || s.name) === stationName
      );

      if (!station) return;

      if (!grouped[stationName]) {
        grouped[stationName] = {
          lat: parseFloat(station.lat),
          lng: parseFloat(station.lon),
          zones: []
        };
      }

      const zoneMatch = site.zone_label.match(/(\d+)-(\d+)m?/);
      if (zoneMatch) {
        const startRadius = parseInt(zoneMatch[1]);
        const endRadius = parseInt(zoneMatch[2]);

        grouped[stationName].zones.push({
          site: site,
          stationName: stationName,
          zoneLabel: site.zone_label,
          startRadius: startRadius,
          endRadius: endRadius,
          score: site.optimal_score || 0
        });
      }
    });

    Object.keys(grouped).forEach(stationName => {
      grouped[stationName].zones.sort((a, b) => a.startRadius - b.startRadius);
    });

    return grouped;
  }

  // 🎨 莫蘭迪色系 - 區間顏色
  function getZoneColor(score) {
    if (score >= 85) return '#86a374ff'; // 莫蘭迪綠 - 優秀
    if (score >= 70) return '#69a7baff'; // 莫蘭迪藍 - 良好
    if (score >= 60) return '#c0a87eff'; // 莫蘭迪米 - 普通
    return '#c78576ff'; // 莫蘭迪玫瑰 - 差
  }

  // 🎨 莫蘭迪色系 - 店家顏色
  function getShopColorMorandi(type) {
    const colors = {
      '咖啡廳': '#fcd9d0ff',   // 莫蘭迪棕
      '簡餐店': '#f4cfadff',   // 莫蘭迪淺棕
      '手搖飲店': '#d7f5c7ff', // 莫蘭迪淡綠
      '早餐店': '#ecce96ff',   // 莫蘭迪米
    };
    return colors[type] || '#a8a89f'; // 預設莫蘭迪灰
  }

  function getZoneFromRadius(radius) {
    if (radius <= 500) return '0-500m';
    if (radius <= 1000) return '500-1000m';
    if (radius <= 1500) return '1000-1500m';
    if (radius <= 2000) return '1500-2000m';
    return `${Math.floor((radius - 500) / 500) * 500}-${radius}m`;
  }

  function createStationInfoWindow(station) {
    return `
      <div style="padding: 12px; min-width: 180px;">
        <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #3a3a35; font-weight: 800;">
          🚇 ${station.station_name || station.name}
        </h3>
        <div style="font-size: 14px; color: #6e6e65;">
          <p style="margin: 4px 0;">
            <strong>每日人流:</strong> 
            ${station.daily_flow ? Math.round(station.daily_flow).toLocaleString() : 'N/A'} 人
          </p>
        </div>
      </div>
    `;
  }

  function createZoneInfoWindow(zone) {
    const { site, zoneLabel } = zone;
    return `
      <div style="padding: 12px; min-width: 220px;">
        <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #3a3a35; font-weight: 800;">
          📍 ${site.mrt_station}
        </h3>
        <div style="font-size: 14px; color: #6e6e65; line-height: 1.6;">
          <p style="margin: 4px 0;"><strong>區間:</strong> ${zoneLabel}</p>
          <p style="margin: 4px 0;"><strong>綜合分數:</strong> ${site.optimal_score?.toFixed(1) || 'N/A'}</p>
          <p style="margin: 4px 0;"><strong>等級:</strong> ${site.score_level || 'N/A'}</p>
          <p style="margin: 4px 0;"><strong>推薦:</strong> ${site.recommendation || 'N/A'}</p>
          <p style="margin: 4px 0;"><strong>供需:</strong> ${site.supply_demand_status || 'N/A'}</p>
          <p style="margin: 8px 0 0 0; font-size: 12px; color: #a8a89f;">點擊查看詳細資訊</p>
        </div>
      </div>
    `;
  }

  function createShopInfoWindow(shop) {
    return `
      <div style="padding: 8px; min-width: 150px;">
        <h4 style="margin: 0 0 4px 0; font-size: 14px; color: #2c2c25ff; font-weight: 700;">
          ${shop.name}
        </h4>
        <p style="margin: 0; font-size: 12px; color: #ebebc3ff;">
          類型: ${shop.type || 'N/A'}
        </p>
        ${shop.category ? `<p style="margin: 0; font-size: 12px; color: #6e6e65;">分類: ${shop.category}</p>` : ''}
      </div>
    `;
  }

  return (
    <div className="map-wrapper">
      {/* 地圖控制按鈕 */}
      <div className="map-controls">
        <button
          className={`control-btn ${showShops ? 'active' : ''}`}
          onClick={() => setShowShops(!showShops)}
          title="顯示/隱藏店家"
        >
          {showShops ? ' 隱藏店家' : ' 顯示店家'}
        </button>
        
        <div className="legend">
          <div className="legend-header">區間評分</div>
          <div className="legend-item">
            <span className="legend-circle" style={{ borderColor: '#e7ffd8ff' }}></span>
            <span>優秀 (85+)</span>
          </div>
          <div className="legend-item">
            <span className="legend-circle" style={{ borderColor: '#e1f8ffff' }}></span>
            <span>良好 (70-85)</span>
          </div>
          <div className="legend-item">
            <span className="legend-circle" style={{ borderColor: '#ffefd2ff' }}></span>
            <span>普通 (60-70)</span>
          </div>
          <div className="legend-item">
            <span className="legend-circle" style={{ borderColor: '#f1c9c0ff' }}></span>
            <span>差 (&lt;60)</span>
          </div>
          <div className="legend-divider"></div>
          <div className="legend-item">
            <span className="legend-station">M</span>
            <span>捷運站</span>
          </div>
        </div>
      </div>

      {/* 地圖容器 */}
      <div 
        ref={mapRef} 
        style={{ width: '100%', height: '100%', borderRadius: '8px' }}
      />
    </div>
  );
}

export default Map;