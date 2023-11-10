Here is some documentation for the main functions and logic in map.js:

- isLibrariesLoaded()
Checks that required libraries are loaded globally before initializing the map. Looks for:

- L - Leaflet
- L.map - Leaflet Map
- L.markerClusterGroup - Leaflet MarkerCluster plugin
- pako - For gzip decompression
Returns true if all libraries are loaded.

- onLibrariesLoaded(attemptCount)
Retries initializing map if libraries not loaded yet.

Calls isLibrariesLoaded() to check if ready
If not ready, waits 1 second and retries (up to 4 attempts)
On final attempt, shows error and reloads page
When ready, calls wait_for_data()

- wait_for_data(promises)
Waits for data files to load before rendering map.

Calls get_data to fetch gzipped data files
Resolves array of Promises returned by get_data()
Renders map when data is loaded into window.data

- get_data()
Fetches and decompresses data files needed for map.

Loads region data files (amerique.json.gz etc.)
Loads CSVs for markers and clusters
Decompresses files using pako
Saves decompressed data to window.data

- mapMusee(data)
Renders the map and markers once data is loaded.

- Access instruments_data from loaded data
- Create Leaflet map object
- Initialize clusters and layers
- Add markers using marker data
- Fit map bounds to markers


- mapMusee(data)
The mapMusee function is called once the data files are loaded and decompressed. It initializes and renders the Leaflet map with markers.

Parameters
- data: Array containing the loaded and parsed data
    data[0] - Instruments data CSV
    data[1] - America region geoJSON
    data[2] - Rest of world region geoJSON
    data[3] - Config object

Functionality

Get the instruments data from the first element of the data array
Get the America and Rest of World geoJSON data
Set default map view settings like zoom level and center coordinates
Create Leaflet map object
Call createDataObject to process instruments data
Initialize clusters and layers
Loop through instrument data to create markers
Add markers to clusters
Fit map bounds to marker locations

