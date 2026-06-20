(function () {
    'use strict';

    /* ═══════════════════════════════════════════════════════════════
       State
       ═══════════════════════════════════════════════════════════════ */
    const state = {
        rates: null,
        countryCurrency: {},
        ratesOK: false,
        countriesOK: false,
        geoJSONLoaded: false
    };

    /* ═══════════════════════════════════════════════════════════════
       DOM refs
       ═══════════════════════════════════════════════════════════════ */
    const statusEl    = document.getElementById('status');
    const currencySel = document.getElementById('currency');
    const balanceInp  = document.getElementById('balance');

    /* ═══════════════════════════════════════════════════════════════
       Status banner helpers
       ═══════════════════════════════════════════════════════════════ */
    function showStatus(mode, html) {
        if (!mode) {
            statusEl.style.display = 'none';
            statusEl.className = '';
            statusEl.innerHTML = '';
            return;
        }
        statusEl.style.display = '';
        statusEl.className = mode;
        statusEl.innerHTML = html;
    }

    /* ═══════════════════════════════════════════════════════════════
       Rate math
       ═══════════════════════════════════════════════════════════════ */
    function getRate(from, to) {
        if (from === to) return 1;
        const rTo   = state.rates[to];
        const rFrom = state.rates[from];
        if (!rTo || !rFrom || rFrom === 0) return 0;
        return rTo / rFrom;
    }

    /* ═══════════════════════════════════════════════════════════════
       Fetch: exchange rates
       ═══════════════════════════════════════════════════════════════ */
    function fetchRates() {
        showStatus('loading', 'Loading exchange rates…');
        fetch('https://api.exchangerate-api.com/v4/latest/USD')
            .then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(function (data) {
                state.rates = data.rates;
                var currencies = Object.keys(data.rates).sort();
                currencySel.innerHTML = currencies.map(function (c) {
                    return '<option value="' + c + '"' + (c === 'USD' ? ' selected' : '') + '>' + c + '</option>';
                }).join('');
                state.ratesOK = true;
                checkReady();
            })
            .catch(function (err) {
                showStatus('error',
                    'Exchange rates failed to load: ' + err.message +
                    '. <button id="retry-rates">Retry</button>');
                document.getElementById('retry-rates').onclick = fetchRates;
            });
    }

    /* ═══════════════════════════════════════════════════════════════
       Fetch: country → currency mapping
       ═══════════════════════════════════════════════════════════════ */
    function fetchCountryCurrency() {
        fetch('https://raw.githubusercontent.com/mledoze/countries/master/countries.json')
            .then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(function (data) {
                for (var i = 0; i < data.length; i++) {
                    var c = data[i];
                    if (c.cca2 && c.currencies) {
                        var cur = Object.keys(c.currencies)[0];
                        state.countryCurrency[c.cca2] = cur;
                        if (c.cca3) state.countryCurrency[c.cca3] = cur;
                        if (c.name && c.name.common) {
                            state.countryCurrency[c.name.common.toLowerCase()] = cur;
                        }
                    }
                }
                state.countriesOK = true;
                checkReady();
            })
            .catch(function (err) {
                showStatus('error',
                    'Country data failed to load: ' + err.message +
                    '. <button id="retry-countries">Retry</button>');
                document.getElementById('retry-countries').onclick = fetchCountryCurrency;
            });
    }

    /* ═══════════════════════════════════════════════════════════════
       Ready check — both data fetches must succeed
       ═══════════════════════════════════════════════════════════════ */
    function checkReady() {
        if (state.ratesOK && state.countriesOK) {
            showStatus(null);
            currencySel.disabled = false;
            balanceInp.disabled = false;
            updateHighlights();
        }
    }

    /* ═══════════════════════════════════════════════════════════════
       Map initialisation
       ═══════════════════════════════════════════════════════════════ */
    var map = L.map('map', {
        scrollWheelZoom: true,
        touchZoom: true,
        dragging: true,
        zoomControl: true,
        zoomSnap: 0.25
    }).setView([20, 0], 2);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19
    }).addTo(map);

    var geoLayer = null;

    function defaultStyle() {
        return { fillColor: '#ccc', fillOpacity: 0.4, color: '#999', weight: 0.5 };
    }

    /* ═══════════════════════════════════════════════════════════════
       GeoJSON load
       ═══════════════════════════════════════════════════════════════ */
    function loadGeoJSON() {
        fetch('https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson')
            .then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(function (data) {
                geoLayer = L.geoJSON(data, {
                    style: defaultStyle,
                    onEachFeature: null  // tooltips set dynamically in updateHighlights
                }).addTo(map);
                state.geoJSONLoaded = true;
                updateHighlights();
            })
            .catch(function (err) {
                showStatus('error',
                    'Map data failed to load: ' + err.message +
                    '. <button id="retry-geojson">Retry</button>');
                document.getElementById('retry-geojson').onclick = loadGeoJSON;
            });
    }

    /* ═══════════════════════════════════════════════════════════════
       Highlight update (debounced)
       ═══════════════════════════════════════════════════════════════ */
    var updateTimer = null;

    function updateHighlights() {
        if (!state.geoJSONLoaded || !geoLayer) return;

        var homeCurrency = currencySel.value;
        var raw    = balanceInp.value.replace(/[^0-9.]/g, '');
        var balance = parseFloat(raw) || 0;

        if (balance === 0) {
            geoLayer.eachLayer(function (layer) {
                geoLayer.resetStyle(layer);
                layer.unbindTooltip();
            });
            return;
        }

        var fmt = new Intl.NumberFormat();

        geoLayer.eachLayer(function (layer) {
            var props = layer.feature.properties;
            var iso2  = props['ISO3166-1-Alpha-2'];
            var name  = props.name || iso2;

            // Try cca2, then cca3, then lowercased name, fallback to raw iso2
            var cc = state.countryCurrency[iso2];
            if (!cc) {
                var iso3 = props['ISO3166-1-Alpha-3'];
                cc = state.countryCurrency[iso3];
            }
            if (!cc) {
                cc = state.countryCurrency[name.toLowerCase()];
            }
            if (!cc) cc = iso2;

            // If the exchange rate API has no rate for this currency, leave grey
            if (!state.rates[cc]) {
                geoLayer.resetStyle(layer);
                layer.bindTooltip('Sorry, we don\u2019t have current exchange rates for ' + name + '.', { sticky: true });
                return;
            }
            var localAmount   = balance * getRate(homeCurrency, cc);
            var isMillionaire = localAmount >= 1000000;
            var isSame        = cc === homeCurrency;

            var color, tooltip;
            var balFmt   = fmt.format(Math.round(balance));
            var localFmt = localAmount ? fmt.format(Math.round(localAmount)) : '0';

            if (isMillionaire) {
                color   = '#2ecc71';
                tooltip = '\u{1F4B0} ' + name + ': ' + balFmt + ' ' + homeCurrency +
                          ' = ' + localFmt + ' ' + cc + '!';
            } else if (isSame) {
                color   = '#f39c12';
                tooltip = '\u{1F9D0} ' + name + ': also uses ' + homeCurrency + '.';
            } else {
                color   = '#e74c3c';
                tooltip = '\u274C ' + name + ': only ' + localFmt + ' ' + cc + '.';
            }

            layer.setStyle({ fillColor: color, fillOpacity: 0.6, color: '#666', weight: 0.5 });
            layer.bindTooltip(tooltip, { sticky: true });
        });
    }

    function debouncedUpdate() {
        clearTimeout(updateTimer);
        updateTimer = setTimeout(updateHighlights, 300);
    }

    /* ═══════════════════════════════════════════════════════════════
       Input formatting — format on blur, raw on focus
       ═══════════════════════════════════════════════════════════════ */
    balanceInp.addEventListener('blur', function () {
        var raw = balanceInp.value.replace(/[^0-9.]/g, '');
        var num = parseFloat(raw);
        if (!isNaN(num)) {
            balanceInp.value = new Intl.NumberFormat().format(num);
        }
    });

    balanceInp.addEventListener('focus', function () {
        balanceInp.value = balanceInp.value.replace(/[^0-9.]/g, '');
    });

    /* ═══════════════════════════════════════════════════════════════
       Event wiring
       ═══════════════════════════════════════════════════════════════ */
    currencySel.addEventListener('change', debouncedUpdate);
    balanceInp.addEventListener('input', debouncedUpdate);
    window.addEventListener('resize', function () { map.invalidateSize(); });

    /* ═══════════════════════════════════════════════════════════════
       Bootstrap
       ═══════════════════════════════════════════════════════════════ */
    fetchRates();
    fetchCountryCurrency();
    loadGeoJSON();

    /* ── Expose retry callbacks for error-banner buttons ── */
    window.millionwhere = {
        fetchRates: fetchRates,
        fetchCountryCurrency: fetchCountryCurrency,
        loadGeoJSON: loadGeoJSON
    };

})();
