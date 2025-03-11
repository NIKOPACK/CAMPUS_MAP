document.addEventListener('DOMContentLoaded', function() {
    const mapImage = '/home/nikopack/develop/test/campus_map/Map_of_Old_Campus.jpg';
    let addingMarker = false;
    let markers = [];
    let imgWidth, imgHeight, map;

    // 获取图片的实际尺寸，用于设置地图边界
    const img = new Image();
    img.onload = function() {
        imgWidth = this.width;
        imgHeight = this.height;
        initializeMap(imgWidth, imgHeight);
    };
    img.src = mapImage;

    // 使用仿射变换参数：计算从经纬度到像素的映射
    // 由下列已知对应关系计算得到：
    // 像素(317,491)   -> (114.36655304465421, 34.81240259618643)
    // 像素(801,1227)  -> (114.36962937077953, 34.80829714447449)
    // 像素(1269,518)  -> (114.37364180580198, 34.811939923108035)
    // 经过求解得到像素坐标(x,y)可通过逆变换计算：
    //   x = ( e*(lon - c) - b*(lat - f) ) / det
    //   y = ( -d*(lon - c) + a*(lat - f) ) / det
    // 其中：
    //   a = 7.465e-6,  b = -7.26e-7,  c = 114.364542
    //   d = -3.337e-7, e = -5.363e-6,  f = 34.815141
    //   det = a*e - b*d
    function gpsToPoint(lat, lon) {
        const a = 7.465e-6, b = -7.26e-7, c = 114.364542;
        const d = -3.337e-7, e = -5.363e-6, f = 34.815141;
        const det = a * e - b * d; // ~ -4.026e-11
        const x = ( e * (lon - c) - b * (lat - f) ) / det;
        const y = ( -d * (lon - c) + a * (lat - f) ) / det;
        return L.point(x, y);
    }

    function initializeMap(imgWidth, imgHeight) {
        // 计算地图的边界（坐标系：南西到北东）
        const southWest = L.latLng(0, 0);
        const northEast = L.latLng(imgHeight, imgWidth);
        const bounds = L.latLngBounds(southWest, northEast);

        // 初始化地图，设置最大边界和缩放级别
        map = L.map('map', {
            crs: L.CRS.Simple,
            maxBounds: bounds.pad(0.5),
            maxZoom: 3,
            minZoom: -2,
        }).fitBounds(bounds);

        // 添加图片作为地图的底图层
        L.imageOverlay(mapImage, bounds).addTo(map);

        // 初始化标记组
        const markersGroup = L.layerGroup().addTo(map);

        // 添加标注按钮的点击事件
        document.getElementById('add-marker').addEventListener('click', function() {
            addingMarker = !addingMarker;
            this.textContent = addingMarker ? '取消添加' : '添加标注';
            this.style.backgroundColor = addingMarker ? '#e74c3c' : '#2980b9';
            document.body.style.cursor = addingMarker ? 'crosshair' : '';
        });

        // 清除所有标注按钮的点击事件
        document.getElementById('clear-markers').addEventListener('click', function() {
            if (confirm('确定要清除所有标注吗？')) {
                markersGroup.clearLayers();
                markers = [];
            }
        });

        // GPS定位按钮点击事件
        document.getElementById('gps-locate').addEventListener('click', function() {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(function(position) {
                    const { latitude, longitude } = position.coords;
                    // 将GPS位置转换为图片坐标
                    const point = gpsToPoint(latitude, longitude);
                    const latlng = L.latLng(point.y, point.x);
                    // 添加或更新GPS定位标记
                    if (map.gpsMarker) {
                        map.gpsMarker.setLatLng(latlng);
                    } else {
                        map.gpsMarker = L.marker(latlng, {title: '我在这里'}).addTo(markersGroup);
                        map.gpsMarker.bindPopup('<b>当前位置</b>').openPopup();
                    }
                    map.panTo(latlng);
                }, function(err) {
                    alert('获取GPS位置失败: ' + err.message);
                });
            } else {
                alert('您的浏览器不支持GPS定位');
            }
        });

        // 地图点击事件，用于添加标注
        map.on('click', function(e) {
            if (addingMarker) {
                const marker = L.marker(e.latlng, { draggable: true }).addTo(markersGroup);
                
                // 生成唯一ID用于标识标记
                const markerId = Date.now();
                marker.markerId = markerId;
                markers.push({ id: markerId, marker: marker });
                
                // 打开标记的编辑窗口
                openMarkerEditPopup(marker);
                
                // 关闭添加标记模式
                addingMarker = false;
                document.getElementById('add-marker').textContent = '添加标注';
                document.getElementById('add-marker').style.backgroundColor = '#2980b9';
                document.body.style.cursor = '';
            }
        });

        // 打开标记编辑窗口
        function openMarkerEditPopup(marker) {
            const popupContent = `
                <div>
                    <input type="text" id="marker-title" placeholder="地点名称" value="${marker.title || ''}">
                    <textarea id="marker-description" placeholder="地点描述" rows="3">${marker.description || ''}</textarea>
                    <button id="save-marker">保存</button>
                    <button id="delete-marker">删除</button>
                </div>
            `;
            
            marker.bindPopup(popupContent).openPopup();
            
            // 延迟绑定事件，确保DOM已生成
            setTimeout(() => {
                // 保存标记信息
                document.getElementById('save-marker').addEventListener('click', function() {
                    const title = document.getElementById('marker-title').value;
                    const description = document.getElementById('marker-description').value;
                    
                    marker.title = title;
                    marker.description = description;
                    
                    const newPopupContent = `
                        <div>
                            <h3>${title}</h3>
                            <p>${description}</p>
                            <button id="edit-marker">编辑</button>
                        </div>
                    `;
                    
                    marker.setPopupContent(newPopupContent);
                    
                    setTimeout(() => {
                        document.getElementById('edit-marker').addEventListener('click', function() {
                            openMarkerEditPopup(marker);
                        });
                    }, 100);
                });
                
                // 删除标记
                document.getElementById('delete-marker').addEventListener('click', function() {
                    markersGroup.removeLayer(marker);
                    markers = markers.filter(m => m.id !== marker.markerId);
                });
            }, 100);
        }

        // 为已有的标记添加点击事件
        markersGroup.eachLayer(function(layer) {
            if (layer instanceof L.Marker) {
                layer.on('click', function() {
                    if (layer.title && layer.description) {
                        const popupContent = `
                            <div>
                                <h3>${layer.title}</h3>
                                <p>${layer.description}</p>
                                <button id="edit-marker">编辑</button>
                            </div>
                        `;
                        layer.setPopupContent(popupContent);
                        
                        setTimeout(() => {
                            document.getElementById('edit-marker').addEventListener('click', function() {
                                openMarkerEditPopup(layer);
                            });
                        }, 100);
                    } else {
                        openMarkerEditPopup(layer);
                    }
                });
            }
        });
    }
});
