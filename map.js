
(() => {


    mapboxgl.accessToken = 'pk.eyJ1IjoiYnJvYnNvbiIsImEiOiJjbDYyMzFrcXMyMzE4M2VucTRwM2lrcDg1In0.pOyITTHCVFYuVOulg045vA';
    window.map = new mapboxgl.Map({
        container: 'map-box',
        style: 'mapbox://styles/brobson/cl46rzjp7000c15mh2qw6oyhq',
        center: [-160.144319, 64.22254],
        zoom: 3, // starting zoom
        maxZoom: 18,
        minZoom: 3,
    });

    window.spiderifier = new MapboxglSpiderfier(map, {
        customPin: true,
        onClick: function (e, spiderLeg) {
            e.stopPropagation();
            e.preventDefault();
            // console.log('Clicked on ', e, spiderLeg);
            const coordinates = [spiderLeg.mapboxMarker._lngLat.lng, spiderLeg.mapboxMarker._lngLat.lat];
            // while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
            //     coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
            // }
            showInfo(coordinates, spiderLeg.marker);
        },
        circleFootSeparation: 40,
    });
    window.SPIDERFY_FROM_ZOOM = 13;
    window.popup = new mapboxgl.Popup();

    let splide;
    popup.on('open', () => {
        // console.log('popup was opened');
        // console.log(popup.getMaxWidth());
        splide = new Splide('.splide', {
            arrows: false,
            height: 280
        }).mount();
    });

    popup.on('close', () => {
        // console.log('popup was closed');
        splide.destroy();
    });

    map.on('style.load', () => {
        // map.setFog({}); // Set the default atmosphere style// Add a new source from our GeoJSON data and
        // set the 'cluster' option to true. GL-JS will
        // add the point_count property to your source data.
        map.addSource('awc-details', {
            type: 'geojson',
            data: 'https://beringwatch.net/db/awc-open-observations.geojson',
            cluster: true,
            clusterMaxZoom: 25, // Max zoom to cluster points on
            clusterRadius: 50 // Radius of each cluster when clustering points (defaults to 50)
        });

        map.addLayer({
            id: 'clusters',
            type: 'circle',
            source: 'awc-details',
            filter: ['has', 'point_count'],
            paint: {
                // Use step expressions (https://docs.mapbox.com/mapbox-gl-js/style-spec/#expressions-step)
                // with three steps to implement three types of circles:
                //   * Blue, 20px circles when point count is less than 100
                //   * Yellow, 30px circles when point count is between 100 and 750
                //   * Pink, 40px circles when point count is greater than or equal to 750
                'circle-color': [
                    'step',
                    ['get', 'point_count'],
                    '#f60',
                    10,
                    '#f60',
                    50,
                    '#f60'
                ],
                'circle-radius': [
                    'step',
                    ['get', 'point_count'],
                    10,
                    10,
                    20,
                    50,
                    35
                ]
            }
        });

        map.addLayer({
            id: 'cluster-count',
            type: 'symbol',
            source: 'awc-details',
            filter: ['has', 'point_count'],
            layout: {
                'text-field': '{point_count_abbreviated}',
                'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
                'text-size': 12
            }
        });

        map.addLayer({
            id: 'unclustered-point',
            type: 'circle',
            source: 'awc-details',
            filter: ['!', ['has', 'point_count']],
            paint: {
                'circle-color': '#f60',
                'circle-radius': 4,
                'circle-stroke-width': 1,
                'circle-stroke-color': '#fff'
            }
        });

        // inspect a cluster on click
        // map.on('click', 'clusters', (e) => {
        //     const features = map.queryRenderedFeatures(e.point, {
        //         layers: ['clusters']
        //     });
        //     const clusterId = features[0].properties.cluster_id;
        //     map.getSource('awc-details').getClusterExpansionZoom(
        //         clusterId,
        //         (err, zoom) => {
        //             if (err) return;

        //             map.easeTo({
        //                 center: features[0].geometry.coordinates,
        //                 zoom: zoom+.4,
        //                 // curve: 0.8,
        //             });
        //         }
        //     );
        // });

        map.on('click', 'unclustered-point', (e) => {
            const coordinates = e.features[0].geometry.coordinates.slice();
            while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
                coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
            }
            showInfo(coordinates, e.features[0].properties);
        });

        map.on('mousemove', mouseMove);
        map.on('click', mouseClick);
        map.on('zoomstart', function () {
            spiderifier.unspiderfy();
        });
    });
})();

function showInfo(coords, properties) {

    if (popup.isOpen()) popup.remove();

    const coordinates = coords.slice();
    const datetime = properties.datetime;
    const id = properties.oid;
    const specie = properties.specie;
    const images = typeof (properties.images) == 'string' ? JSON.parse(properties.images) : properties.images;

    let html = `<div class="awc-detail">
                            <h2 class="awc-detail__title">${specie}</h2>
                            <h4 class="awc-detail__id">${id}</h4>
                            <div class="awc-detail__datetime">${datetime}</div>
                            <div class="splide" role="group" aria-label="AWC detail images">
                                <div class="splide__track">
                                    <ul class="splide__list">`
    images.forEach(element => {
        html += `<li class="splide__slide"><img class="awc-detail__image" src="${element}"/></li>`;
    });
    html += `
                                    </ul>
                                </div>
                            </div>
                            </div>`;

    popup.setLngLat(coords)
        .setMaxWidth('320px')
        .setHTML(html).addTo(map);
}


function mouseClick(e) {
    var features = map.queryRenderedFeatures(e.point, {
        layers: ['clusters']
    });

    spiderifier.unspiderfy();
    if (!features.length) {
        return;
    } else if (map.getZoom() < SPIDERFY_FROM_ZOOM) {
        map.easeTo({
            center: e.lngLat,
            zoom: map.getZoom() + 2
        });
    } else {
        map.getSource('awc-details').getClusterLeaves(
            features[0].properties.cluster_id,
            100,
            0,
            function (err, leafFeatures) {
                if (err) {
                    return console.error('error while getting leaves of a cluster', err);
                }
                var markers = Array.prototype.map.call(leafFeatures, function (leafFeature) {
                    return leafFeature.properties;
                });
                spiderifier.spiderfy(features[0].geometry.coordinates, markers);
            }
        );
    }
}

function mouseMove(e) {
    var features = map.queryRenderedFeatures(e.point, {
        layers: ['clusters', 'unclustered-point']
    });
    map.getCanvas().style.cursor = (features.length) ? 'pointer' : '';
}

