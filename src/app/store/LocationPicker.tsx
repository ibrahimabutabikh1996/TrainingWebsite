"use client";

import { useEffect, useRef, useState } from "react";
import { Crosshair, LoaderCircle, MapPin } from "lucide-react";
import type { Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";
import { GOVERNORATE_CENTERS, IRAQ_CENTER, isInIraq, type GeoPoint } from "@/lib/store/types";

/* The delivery pin.
 *
 * OpenStreetMap's own tiles through Leaflet — free and keyless (CARTO's dark
 * set now asks for an API key). They are drawn light, so store.css inverts the
 * tile layer to sit in the site's dark glass; the pin and controls are not
 * inverted. A tap
 * anywhere drops the pin there; the pin can be dragged; "موقعي الحالي" asks
 * the browser. Leaflet touches `window` on import, so it is loaded inside the
 * effect, never during the server render.
 *
 * The pin is a styled div rather than Leaflet's default marker image, which is
 * a PNG Leaflet looks for at a path a bundler moves. */

interface LocationPickerProps {
  value: GeoPoint | null;
  onChange: (point: GeoPoint) => void;
  /** The chosen governorate — the map flies there until a pin is dropped. */
  city: string;
  invalid?: boolean;
}

const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export function LocationPicker({ value, onChange, city, invalid }: LocationPickerProps) {
  const holderRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const placeRef = useRef<(point: GeoPoint) => void>(() => {});
  const onChangeRef = useRef(onChange);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  /* Build the map once. */
  useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | null = null;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !holderRef.current) return;

      const start = value ? [value.lat, value.lng] : GOVERNORATE_CENTERS[city] ?? IRAQ_CENTER;
      map = L.map(holderRef.current, {
        center: start as [number, number],
        zoom: value ? 16 : city ? 12 : 6,
        zoomControl: true,
        attributionControl: true,
      });
      L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map);

      const icon = L.divIcon({
        className: "st-map-pin",
        html: '<span class="st-map-pin-dot"></span>',
        iconSize: [36, 46],
        iconAnchor: [18, 44],
      });

      const place = (point: GeoPoint) => {
        if (!map) return;
        if (markerRef.current) {
          markerRef.current.setLatLng([point.lat, point.lng]);
        } else {
          const marker = L.marker([point.lat, point.lng], { icon, draggable: true, autoPan: true }).addTo(map);
          marker.on("dragend", () => {
            const ll = marker.getLatLng();
            onChangeRef.current({ lat: ll.lat, lng: ll.lng });
          });
          markerRef.current = marker;
        }
      };
      placeRef.current = place;

      if (value) place(value);

      map.on("click", (e) => {
        const point = { lat: e.latlng.lat, lng: e.latlng.lng };
        place(point);
        onChangeRef.current(point);
      });

      mapRef.current = map;
      /* The drawer slides in; measure once it has a size. */
      window.setTimeout(() => map?.invalidateSize(), 320);
    })();

    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- built once; value and city are followed below
  }, []);

  /* A governorate picked before any pin: go there. */
  useEffect(() => {
    if (!value && city && mapRef.current && GOVERNORATE_CENTERS[city]) {
      mapRef.current.flyTo(GOVERNORATE_CENTERS[city], 12, { duration: 0.8 });
    }
  }, [city, value]);

  const useMyLocation = () => {
    setGeoError(null);
    if (!("geolocation" in navigator)) {
      setGeoError("متصفحك لا يدعم تحديد الموقع — ضع الدبوس على الخريطة يدوياً");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (!isInIraq(point)) {
          setGeoError("موقعك الحالي خارج العراق — ضع الدبوس على عنوان التوصيل");
          return;
        }
        placeRef.current(point);
        onChangeRef.current(point);
        mapRef.current?.flyTo([point.lat, point.lng], 17, { duration: 0.8 });
      },
      (err) => {
        setLocating(false);
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? "لم يُسمح بالوصول للموقع — فعّله من إعدادات المتصفح أو ضع الدبوس يدوياً"
            : "تعذّر تحديد موقعك — ضع الدبوس على الخريطة يدوياً"
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  };

  return (
    <div className={`st-map${invalid ? " is-invalid" : ""}`}>
      <div className="st-map-frame">
        <div ref={holderRef} className="st-map-canvas" aria-label="خريطة موقع التوصيل" />
        {!value && (
          <div className="st-map-hint" aria-hidden="true">
            <MapPin /> اضغط على الخريطة لتحديد موقع التوصيل
          </div>
        )}
      </div>
      <div className="st-map-actions">
        <button type="button" className="ui-btn ui-btn--secondary ui-btn--sm st-map-locate" onClick={useMyLocation} disabled={locating}>
          {locating ? <LoaderCircle aria-hidden="true" className="st-spin" /> : <Crosshair aria-hidden="true" />}
          {locating ? "جارِ تحديد موقعك…" : "استخدم موقعي الحالي"}
        </button>
        {value && <span className="st-map-ok"><MapPin aria-hidden="true" /> تم تحديد الموقع — اسحب الدبوس للتعديل</span>}
      </div>
      {geoError && <em className="st-map-error">{geoError}</em>}
    </div>
  );
}
