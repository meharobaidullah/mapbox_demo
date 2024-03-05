import React, { useState } from "react";
import ReactMapGL, {
  Marker,
  NavigationControl,
  Source,
  Layer,
} from "react-map-gl";
import Papa from "papaparse";
import "mapbox-gl/dist/mapbox-gl.css";
import axios from "axios";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN as string;

const MapBoxComponent: React.FC = () => {
  const [viewport, setViewport] = useState({
    latitude: 37.387474,
    longitude: -122.057543,
    zoom: 10,
    bearing: 0,
    pitch: 0,
  });

  const [markers, setMarkers] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [refLocation, setRefLocation] = useState("");

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.length) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = e.target?.result as string;
        Papa.parse(text, {
          header: true,
          complete: async (results) => {
            const addresses = results.data.map((row: any) => row.address);

            const coordinatePromises = addresses.map(async (address) => {
              const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
                address
              )}.json?access_token=${mapboxToken}&limit=1`;

              try {
                const response = await axios.get(url);
                if (response.data.features.length > 0) {
                  const [longitude, latitude] =
                    response.data.features[0].center;
                  return { latitude, longitude };
                }
                return null;
              } catch (error) {
                console.error("Error fetching geocoding data:", error);
                return null;
              }
            });

            const coordinates = await Promise.all(coordinatePromises);
            setMarkers(coordinates.filter((coord) => coord)); // Filter out any null values
          },
        });
      };
      reader.readAsText(event.target.files[0]);
    }
  };

  const handleReferenceLocationChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setRefLocation(event.target.value);
  };

  const showRoute = async () => {
    if (!refLocation.trim()) {
      alert("Please enter a reference location.");
      return;
    }

    let refCoords;

    try {
      const geocodeUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
        refLocation
      )}.json?access_token=${mapboxToken}&limit=1`;

      const geocodeResp = await axios.get(geocodeUrl);

      if (geocodeResp.data.features.length === 0) {
        alert("Reference location not found. Please enter a valid location.");
        return;
      }

      refCoords = geocodeResp.data.features[0].center;
    } catch (error) {
      console.error("Error fetching geocoding data:", error);
      alert("Failed to fetch location data. Please try again.");
      return;
    }

    const newRoutes = [];

    for (const marker of markers) {
      try {
        const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${refCoords[0]},${refCoords[1]};${marker.longitude},${marker.latitude}?geometries=geojson&access_token=${mapboxToken}`;
        const directionsResp = await axios.get(directionsUrl);

        if (directionsResp.data.routes.length === 0) {
          console.log("No route found to one of the markers.");
          continue; // Skip if no route is found
        }

        const route = directionsResp.data.routes[0].geometry;
        newRoutes.push(route);
      } catch (error) {
        console.error("Error fetching directions data:", error);
      }
    }

    setRoutes(newRoutes);
  };

  return (
    <div className="container my-10">
      <div className="flex flex-col justify-center items-center">
        <div className="grid w-full max-w-sm items-center gap-1.5">
          <Label htmlFor="picture">Upload .CSV File</Label>
          <Input type="file" accept=".csv" onChange={handleFileUpload} />
        </div>

        {!!markers.length && <Separator className="my-5" />}

        {!!markers.length && (
          <div className="flex w-full max-w-sm items-center space-x-2">
            <Input
              type="text"
              value={refLocation}
              onChange={handleReferenceLocationChange}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  showRoute();
                }
              }}
              placeholder="Enter reference location"
            />

            <Button onClick={showRoute}>Show Routes</Button>
          </div>
        )}
      </div>

      <div className="w-full h-96 mt-10">
        <ReactMapGL
          {...viewport}
          onMove={(evt) => setViewport(evt.viewState)}
          mapboxAccessToken={mapboxToken}
          mapStyle="mapbox://styles/mapbox/streets-v11"
        >
          {markers.map((marker, index) => (
            <Marker
              key={index}
              latitude={marker.latitude}
              longitude={marker.longitude}
            >
              <div
                style={{
                  backgroundColor: "red",
                  height: "10px",
                  width: "10px",
                  borderRadius: "50%",
                }}
              ></div>
            </Marker>
          ))}

          <NavigationControl />

          {routes.map((route, index) => (
            <Source key={index} type="geojson" data={route}>
              <Layer
                id={`route-${index}`}
                type="line"
                layout={{
                  "line-join": "round",
                  "line-cap": "round",
                }}
                paint={{
                  "line-color": "#888",
                  "line-width": 5,
                }}
              />
            </Source>
          ))}
        </ReactMapGL>
      </div>
    </div>
  );
};
export default MapBoxComponent;
