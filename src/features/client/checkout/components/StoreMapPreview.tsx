import { GoogleMap, MarkerF, useJsApiLoader } from "@react-google-maps/api";
import { Center, Loader, Text } from "@mantine/core";

interface StoreMapPreviewProps {
  lat: number;
  lng: number;
  height?: number;
}

/** Preview no interactiva: la dirección se modifica desde el selector principal. */
export default function StoreMapPreview({ lat, lng, height = 250 }: StoreMapPreviewProps) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
  });

  if (loadError) {
    return <Text size="xs" c="dimmed">No se pudo mostrar la vista previa. Puedes abrir Google Maps desde el enlace.</Text>;
  }
  if (!isLoaded) {
    return <Center h={height}><Loader color="red" size="sm" /></Center>;
  }

  const point = { lat, lng };
  return (
    <GoogleMap
      mapContainerStyle={{ width: "100%", height: height + "px", borderRadius: "11px" }}
      center={point}
      zoom={16}
      options={{
        disableDefaultUI: true,
        gestureHandling: "none",
        keyboardShortcuts: false,
        clickableIcons: false,
        draggable: false,
        scrollwheel: false,
      }}
    >
      <MarkerF position={point} />
    </GoogleMap>
  );
}
