let map;
let roadLayer;
let satelliteLayer;
let markers = [];
let polyline;
let activeLayout = null;

const LAYOUT_CENTERS = {
    'DRD BALADHANDAYUTHABANI GARDEN': [10.95, 76.85],
    'DRD SKANDA ENCLAVE': [10.942, 76.808]
};

const LANDMARKS = [
    { name: 'Isha Yoga Center 🕉️', coords: [10.9427, 76.6826] },
    { name: 'Kovaipudur Road Junction', coords: [10.9161, 76.9248] }
];

const SIRUVANI_ROAD_PATH = [
    [10.9161, 76.9248], // Entry
    [10.9329, 76.8778],
    [10.9442, 76.8322],
    [10.9567, 76.7758],
    [10.9427, 76.6826]  // Toward Isha
];

async function initMap() {
    // Center of all layouts approx
    const defaultCenter = [10.96, 76.85];
    
    map = L.map('map', {
        zoomControl: false
    }).setView(defaultCenter, 13);

    roadLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ',
        className: 'map-tiles-road'
    });

    satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    });

    roadLayer.addTo(map);

    // Zoom control to bottom right
    L.control.zoom({
        position: 'bottomright'
    }).addTo(map);

    try {
        const data = LAYOUT_DATA;
        
        // Fill missing coords if needed
        data.forEach(item => {
            if (!item.coords && LAYOUT_CENTERS[item.name]) {
                item.coords = LAYOUT_CENTERS[item.name];
            }
        });

        loadLayoutList(data);
        plotMarkers(data);
        plotLandmarks();
        drawSiruvaniRoad();
        drawConnections(data);

        // Auto-center map to fit all points
        const validCoords = data.filter(d => d.coords).map(d => d.coords);
        if (validCoords.length > 0) {
            map.fitBounds(L.latLngBounds([...validCoords, ...LANDMARKS.map(l => l.coords)]), { padding: [50, 50] });
        }

    } catch (e) {
        console.error("Error loading layout data", e);
    }
}

function loadLayoutList(data) {
    const list = document.getElementById('layout-list');
    list.innerHTML = '';
    
    data.forEach(item => {
        const div = document.createElement('div');
        div.className = 'layout-card';
        div.innerHTML = `
            <span class="badge">Available: ${item.available_count}</span>
            <h3>${item.name}</h3>
            <div class="stats">
                <span><i class="icon-area"></i> ${item.total_area.toLocaleString()} sqft</span>
                <span><i class="icon-price"></i> ${item.price_range}</span>
            </div>
        `;
        div.onclick = () => focusLayout(item);
        list.appendChild(div);
    });
}

function plotMarkers(data) {
    const customIcon = L.divIcon({
        className: 'custom-marker',
        html: '<div class="pin"></div>',
        iconSize: [30, 30],
        iconAnchor: [15, 30]
    });

    data.forEach(item => {
        if (!item.coords) return;
        
        const marker = L.marker(item.coords, { icon: customIcon }).addTo(map);
        marker.bindTooltip(item.name, { 
            permanent: false, 
            direction: 'top', 
            className: 'marker-tooltip' 
        });
        
        marker.on('click', () => focusLayout(item));
        markers.push({ name: item.name, marker });
    });
}

function plotLandmarks() {
    const landmarkIcon = L.divIcon({
        className: 'custom-marker',
        html: '<div class="pin landmark-pin"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 20]
    });

    LANDMARKS.forEach(l => {
        L.marker(l.coords, { icon: landmarkIcon }).addTo(map)
            .bindTooltip(l.name, { 
                permanent: true, 
                direction: 'top', 
                className: 'marker-tooltip landmark-tooltip' 
            });
    });
}

function drawSiruvaniRoad() {
    L.polyline(SIRUVANI_ROAD_PATH, {
        color: '#3498db',
        weight: 6,
        opacity: 0.4,
        lineJoin: 'round'
    }).addTo(map).bindTooltip("Siruvani Main Road 🛣️", { sticky: true, className: 'road-tooltip' });
}

function drawConnections(data) {
    const coords = data.filter(d => d.coords).map(d => d.coords);
    if (coords.length < 2) return;

    // Draw a dashed polyline connecting them
    polyline = L.polyline(coords, {
        color: '#d4af37',
        weight: 3,
        dashArray: '10, 10',
        opacity: 0.6
    }).addTo(map);
}

function focusLayout(item) {
    if (!item.coords) {
        alert("GPS Coordinates for " + item.name + " are not available yet.");
        return;
    }

    // Close mobile menu if open
    document.getElementById('sidebar').classList.remove('mobile-open');

    map.flyTo(item.coords, 16, {
        duration: 1.5
    });

    showInfoPanel(item);
}

function showInfoPanel(item) {
    const panel = document.getElementById('info-panel');
    const content = panel.querySelector('.info-content');
    
    let imagesHtml = '';
    if (item.images && item.images.length > 0) {
        imagesHtml = `
            <h4>Visual Layout & Photos</h4>
            <div class="gallery">
                ${item.images.map(img => `<img src="${img}" alt="Layout Image" onclick="openModal('${img}', '${item.name}')">`).join('')}
            </div>
        `;
    }

    let plansHtml = '';
    if (item.plans && item.plans.length > 0) {
        plansHtml = `
            <h4>Layout Plans (PDF)</h4>
            <div class="plans-list" style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 20px;">
                ${item.plans.map(plan => {
                    const filename = plan.split('/').pop();
                    return `<a href="${plan}" target="_blank" class="plan-btn" style="background: #333; color: var(--primary); padding: 8px 15px; border-radius: 8px; border: 1px solid var(--primary); text-decoration: none; font-size: 0.85rem; font-weight: 600;">📄 ${filename}</a>`;
                }).join('')}
            </div>
        `;
    }

    content.innerHTML = `
        <div class="info-header">
            <div class="info-title">
                <h2>${item.name}</h2>
                <p>${item.plots_count} Plots Total | ${item.available_count} Available Now</p>
            </div>
            <div class="price-tag">${item.price_range}</div>
        </div>
        <div class="info-body">
            <p>Experience the premium living at ${item.name}. Total development area of ${item.total_area.toLocaleString()} sq.ft. feature ${item.plots_count} individual residential plots.</p>
            ${plansHtml}
            ${imagesHtml}
        </div>
    `;

    panel.classList.remove('hidden');
}

// Mobile Toggle
document.getElementById('btn-list-mobile').onclick = () => {
    document.getElementById('sidebar').classList.toggle('mobile-open');
};

// Map Controls
document.getElementById('btn-road').onclick = (e) => {
    map.removeLayer(satelliteLayer);
    roadLayer.addTo(map);
    e.target.classList.add('active');
    document.getElementById('btn-satellite').classList.remove('active');
};

document.getElementById('btn-satellite').onclick = (e) => {
    map.removeLayer(roadLayer);
    satelliteLayer.addTo(map);
    e.target.classList.add('active');
    document.getElementById('btn-road').classList.remove('active');
};

document.querySelector('.close-btn').onclick = () => {
    document.getElementById('info-panel').classList.add('hidden');
};

// Modal Functions
function openModal(src, name) {
    const modal = document.getElementById('image-modal');
    const modalImg = document.getElementById('modal-img');
    const captionText = document.getElementById('caption');
    modal.style.display = "block";
    modalImg.src = src;
    captionText.innerHTML = name;
}

document.querySelector('.close-modal').onclick = () => {
    document.getElementById('image-modal').style.display = "none";
};

// Extra Styles for Marker
const style = document.createElement('style');
style.innerHTML = `
    .custom-marker .pin {
        width: 16px;
        height: 16px;
        background: #d4af37;
        border: 4px solid #fff;
        border-radius: 50%;
        box-shadow: 0 0 10px rgba(0,0,0,0.5), 0 0 20px rgba(212, 175, 55, 0.4);
    }
    .marker-tooltip {
        background: #1e1e1e;
        color: #d4af37;
        border: 1px solid #d4af37;
        font-weight: 600;
        font-family: 'Outfit', sans-serif;
    }
    .landmark-pin {
        background: #9b59b6 !important;
        width: 12px !important;
        height: 12px !important;
    }
    .landmark-tooltip {
        color: #fff !important;
        border-color: #9b59b6 !important;
    }
    .road-tooltip {
        background: #34495e;
        color: #fff;
        border: none;
        border-radius: 4px;
        padding: 4px 8px;
    }
`;
document.head.appendChild(style);

initMap();
