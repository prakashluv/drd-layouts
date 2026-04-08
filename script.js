let map;
let roadLayer;
let satelliteLayer;
let markers = [];
let polyline;
let activeLayout = null;
let currentGalleryItems = [];
let currentGalleryIndex = 0;

const LAYOUT_CENTERS = {
    'DRD BALADHANDAYUTHABANI GARDEN': [10.9668608, 76.8337816],
    'DRD SKANDA ENCLAVE': [10.9632537, 76.8194371]
};

const LANDMARKS = [
    { name: 'Isha Yoga Center 🕉️', coords: [10.9427, 76.6826] },
    { name: 'Kovaipudur Road Junction', coords: [10.9161, 76.9248] }
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

        drawConnections(data);

        // Auto-center map to fit all points
        const validCoords = data.filter(d => d.coords).map(d => d.coords);
        if (validCoords.length > 0) {
            map.fitBounds(L.latLngBounds([...validCoords, ...LANDMARKS.map(l => l.coords)]), { padding: [100, 100] });
        }

        setupSidebarToggle();
        setupSearch();
        setupMapControls();

    } catch (e) {
        console.error("Error loading layout data", e);
    }
}

function setupSidebarToggle() {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('btn-toggle-sidebar');
    
    toggleBtn.onclick = () => {
        sidebar.classList.toggle('collapsed');
    };
}

function setupSearch() {
    const input = document.getElementById('search-input');
    const btn = document.getElementById('search-btn');

    const doSearch = () => {
        const query = input.value.toLowerCase();
        const filtered = LAYOUT_DATA.filter(item => 
            item.name.toLowerCase().includes(query) || 
            (item.price_range && item.price_range.toLowerCase().includes(query))
        );
        loadLayoutList(filtered);
        
        // Filter markers on map
        markers.forEach(m => {
            const match = m.name.toLowerCase().includes(query);
            if (match) {
                m.marker.setOpacity(1);
            } else {
                m.marker.setOpacity(query ? 0.2 : 1);
            }
        });
    };

    input.oninput = doSearch;
    btn.onclick = doSearch;
}

function setupMapControls() {
    document.getElementById('btn-zoom-in').onclick = () => map.zoomIn();
    document.getElementById('btn-zoom-out').onclick = () => map.zoomOut();
    document.getElementById('btn-locate').onclick = () => {
        map.locate({setView: true, maxZoom: 16});
    };

    map.on('locationfound', (e) => {
        const radius = e.accuracy / 2;
        L.circle(e.latlng, radius, {
            color: '#4285F4',
            fillColor: '#4285F4',
            fillOpacity: 0.15,
            weight: 1
        }).addTo(map);
        
        L.circleMarker(e.latlng, {
            radius: 8,
            color: '#fff',
            fillColor: '#4285F4',
            fillOpacity: 1,
            weight: 2
        }).addTo(map).bindPopup("You are here").openPopup();
    });

    // Right-click to copy coordinates (Google Maps style)
    map.on('contextmenu', (e) => {
        const { lat, lng } = e.latlng;
        const coords = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        
        const popup = L.popup()
            .setLatLng(e.latlng)
            .setContent(`<div style="padding: 10px; cursor: pointer;" onclick="navigator.clipboard.writeText('${coords}'); this.innerHTML='Copied!'; setTimeout(() => this.closest('.leaflet-popup').remove(), 1000);">
                            <strong>${coords}</strong><br>
                            <span style="font-size: 0.8rem; color: #666;">Click to copy</span>
                         </div>`)
            .openOn(map);
    });
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
        html: `
            <svg width="27" height="43" viewBox="0 0 27 43" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M13.5 0C6.04416 0 0 6.04416 0 13.5C0 23.625 13.5 43 13.5 43C13.5 43 27 23.625 27 13.5C27 6.04416 20.9558 0 13.5 0Z" fill="#EA4335"/>
                <circle cx="13.5" cy="13.5" r="5.5" fill="white"/>
            </svg>
        `,
        iconSize: [27, 43],
        iconAnchor: [13.5, 43]
    });

    data.forEach(item => {
        if (!item.coords) return;
        
        const marker = L.marker(item.coords, { icon: customIcon }).addTo(map);
        marker.bindTooltip(item.name, { 
            permanent: true, 
            direction: 'bottom', 
            offset: [0, 5],
            className: 'marker-tooltip layout-tooltip' 
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
        showInfoPanel(item); // Still show info, just no flyTo
        document.getElementById('sidebar').classList.remove('mobile-open');
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
            <div class="inner-padding" style="padding: 20px;">
                <h4 style="margin-bottom: 12px; font-size: 1rem; color: #555;">Visual Layout & Photos</h4>
                <div class="gallery">
                    ${item.images.map((img, idx) => `<img src="${img}" alt="Layout Image" onclick="openModal(${idx}, '${item.name}', ${JSON.stringify(item.images).replace(/"/g, '&quot;')})">`).join('')}
                </div>
            </div>
        `;
    }

    let plansHtml = '';
    if (item.plans && item.plans.length > 0) {
        plansHtml = `
            <div class="inner-padding" style="padding: 0 20px 20px 20px;">
                <h4 style="margin-bottom: 12px; font-size: 1rem; color: #555;">Layout Plans (PDF)</h4>
                <div class="plans-list" style="display: flex; gap: 10px; flex-wrap: wrap;">
                    ${item.plans.map(plan => {
                        const filename = plan.split('/').pop();
                        return `<a href="${plan}" target="_blank" class="plan-btn" style="background: #f8f9fa; color: #4285F4; padding: 10px 15px; border-radius: 8px; border: 1px solid #dee2e6; text-decoration: none; font-size: 0.85rem; font-weight: 600; display: flex; align-items: center; gap: 8px;">📄 ${filename}</a>`;
                    }).join('')}
                </div>
            </div>
        `;
    }

    const headerImg = item.images && item.images.length > 0 ? item.images[0] : 'Layout_Images/02 DRD Taglines/Logo.jpeg';

    content.innerHTML = `
        <img src="${headerImg}" class="info-header-img" alt="${item.name}">
        <div class="info-header" style="padding: 20px; border-bottom: 1px solid #eee; margin-bottom: 0;">
            <div class="info-title">
                <h2 style="color: #202124; font-size: 1.5rem; margin-bottom: 4px;">${item.name}</h2>
                <div style="display: flex; align-items: center; gap: 10px; color: #70757a; font-size: 0.9rem;">
                    <span style="color: #188038; font-weight: 600;">Available Now</span>
                    <span>•</span>
                    <span>${item.plots_count} Plots Total</span>
                </div>
            </div>
            <div class="price-tag" style="background: #e8f0fe; color: #1967d2; border: none; font-size: 0.9rem;">${item.price_range}</div>
        </div>
        <div class="info-body">
            <div style="padding: 20px; color: #3c4043; line-height: 1.6; font-size: 0.95rem;">
                <p>Experience the premium living at ${item.name}. Total development area of ${item.total_area.toLocaleString()} sq.ft. feature ${item.plots_count} individual residential plots.</p>
            </div>
            <div style="padding: 0 20px 20px 20px; display: flex; gap: 10px; flex-wrap: wrap;">
                <button onclick="window.open('https://www.google.com/maps/dir/?api=1&destination=${item.coords[0]},${item.coords[1]}', '_blank')" style="flex: 1; min-width: 140px; background: #4285F4; color: #fff; border: none; padding: 12px; border-radius: 25px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <span style="font-size: 1.2rem;">🚗</span> Directions
                </button>
                <button id="share-btn-panel" onclick="shareLocation('${item.name}', ${item.coords[0]}, ${item.coords[1]})" style="flex: 1; min-width: 140px; background: #fff; color: #4285F4; border: 1px solid #4285F4; padding: 12px; border-radius: 25px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <span style="font-size: 1.2rem;">🔗</span> Share Plot
                </button>
            </div>
            ${plansHtml}
            ${imagesHtml}
            <div style="padding: 20px; border-top: 1px solid #eee; display: flex; gap: 10px;">
                <a href="https://wa.me/919655766666?text=I'm interested in ${item.name}" target="_blank" style="flex: 1; background: #188038; color: #fff; text-align: center; padding: 12px; border-radius: 25px; text-decoration: none; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" style="width: 20px; filter: brightness(0) invert(1);"> Enquire Now
                </a>
                <button onclick="window.print()" style="padding: 12px; border-radius: 50%; border: 1px solid #ddd; background: #fff; cursor: pointer;" title="Print Details">🖨️</button>
            </div>
        </div>
    `;

    panel.classList.remove('hidden');
    // Ensure search box and controls shift if sidebar is open (handled by CSS)
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
function openModal(index, name, items) {
    currentGalleryIndex = index;
    currentGalleryItems = items;
    
    updateModalContent(name);
    document.getElementById('image-modal').style.display = "block";
}

function updateModalContent(name) {
    const modalImg = document.getElementById('modal-img');
    const captionText = document.getElementById('caption');
    
    modalImg.src = currentGalleryItems[currentGalleryIndex];
    captionText.innerHTML = `${name} (${currentGalleryIndex + 1} / ${currentGalleryItems.length})`;
}

function nextModalImage() {
    if (currentGalleryItems.length === 0) return;
    currentGalleryIndex = (currentGalleryIndex + 1) % currentGalleryItems.length;
    updateModalContent(activeLayout ? activeLayout.name : "DRD Realtors");
}

function prevModalImage() {
    if (currentGalleryItems.length === 0) return;
    currentGalleryIndex = (currentGalleryIndex - 1 + currentGalleryItems.length) % currentGalleryItems.length;
    updateModalContent(activeLayout ? activeLayout.name : "DRD Realtors");
}

document.querySelector('.modal-next').onclick = (e) => {
    e.stopPropagation();
    nextModalImage();
};

document.querySelector('.modal-prev').onclick = (e) => {
    e.stopPropagation();
    prevModalImage();
};

document.getElementById('image-modal').onclick = (e) => {
    if (e.target.id === 'image-modal') {
        document.getElementById('image-modal').style.display = "none";
    }
};

document.querySelector('.close-modal').onclick = () => {
    document.getElementById('image-modal').style.display = "none";
};

// Keypress navigation
document.addEventListener('keydown', (e) => {
    if (document.getElementById('image-modal').style.display === "block") {
        if (e.key === "ArrowRight") nextModalImage();
        if (e.key === "ArrowLeft") prevModalImage();
        if (e.key === "Escape") document.getElementById('image-modal').style.display = "none";
    }
});

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
        background: white !important;
        color: #333 !important;
        border: none !important;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2) !important;
        font-weight: 600 !important;
        font-family: 'Outfit', sans-serif !important;
        padding: 5px 12px !important;
        border-radius: 4px !important;
    }
    .layout-tooltip::before { border-top-color: white !important; }
    
    .landmark-pin {
        background: #9b59b6 !important;
        width: 14px !important;
        height: 14px !important;
        border: 2px solid white !important;
    }
    .landmark-tooltip {
        color: #9b59b6 !important;
        background: white !important;
    }
    .road-tooltip {
        background: rgba(52, 152, 219, 0.9);
        color: #fff;
        border: none;
        border-radius: 20px;
        padding: 4px 15px;
        font-weight: 700;
        letter-spacing: 0.5px;
    }
    
    /* Google Maps Blue pulse for user location */
    .leaflet-control-locate {
        background: #fff;
        border-radius: 50%;
        box-shadow: 0 1px 5px rgba(0,0,0,0.4);
    }
`;
document.head.appendChild(style);

function shareLocation(name, lat, lng) {
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    const text = `Check out this plot at ${name}: ${url}`;
    
    if (navigator.share) {
        navigator.share({
            title: name,
            text: text,
            url: url
        }).catch(err => {
            copyToClipboard(url);
        });
    } else {
        copyToClipboard(url);
    }
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById('share-btn-panel');
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '✅ Copied!';
        setTimeout(() => {
            btn.innerHTML = originalHtml;
        }, 2000);
    });
}

initMap();
