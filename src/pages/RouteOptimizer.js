import { useState, useEffect, useCallback, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Car,
  Footprints,
  MapPin,
  Navigation,
  Plus,
  Trash2,
  Route,
  Sparkles,
  Search,
  Loader2,
  FolderPlus,
  Check,
  XCircle,
  Undo2,
  GripVertical,
  Pencil,
  StickyNote,
  Palette,
  SkipForward,
} from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}`;

// Fix Leaflet default icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// Color options for waypoints
const WAYPOINT_COLORS = {
  blue: { bg: "#3b82f6", label: "Bleu" },
  green: { bg: "#22c55e", label: "Vert" },
  red: { bg: "#ef4444", label: "Rouge" },
  orange: { bg: "#f97316", label: "Orange" },
  purple: { bg: "#a855f7", label: "Violet" },
  pink: { bg: "#ec4899", label: "Rose" },
  yellow: { bg: "#eab308", label: "Jaune" },
  gray: { bg: "#6b7280", label: "Gris" },
};

// Status colors
const STATUS_COLORS = {
  pending: null,
  completed: "#22c55e",
  failed: "#ef4444",
  skipped: "#94a3b8",
};

const STATUS_LABELS = {
  pending: "En attente",
  completed: "Livré",
  failed: "Échec",
  skipped: "Ignoré",
};

// Custom marker icons
const createIcon = (color, label, opacity = 1) => {
  return L.divIcon({
    className: "custom-div-icon",
    html: `<div class="custom-marker" style="background-color: ${color}; opacity: ${opacity};">${label}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
};

// Map bounds updater
function MapBoundsUpdater({ markers }) {
  const map = useMap();
  useEffect(() => {
    if (markers.length > 0) {
      const bounds = L.latLngBounds(markers.map(m => [m.lat, m.lng]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [markers, map]);
  return null;
}

// Waypoint Detail Dialog
function WaypointDetailDialog({ wp, idx, isOpen, onClose, onUpdate, onDelete }) {
  const [editName, setEditName] = useState(wp.name);
  const [editNote, setEditNote] = useState(wp.note || "");
  const [editColor, setEditColor] = useState(wp.color || "blue");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEditName(wp.name);
    setEditNote(wp.note || "");
    setEditColor(wp.color || "blue");
  }, [wp]);

  const handleSave = async () => {
    setSaving(true);
    await onUpdate(wp.id, { name: editName, note: editNote, color: editColor });
    setSaving(false);
    onClose();
  };

  const handleStatusChange = async (status) => {
    setSaving(true);
    await onUpdate(wp.id, { status });
    setSaving(false);
    onClose();
  };

  const status = wp.status || "pending";
  const currentColor = STATUS_COLORS[status] || WAYPOINT_COLORS[editColor]?.bg || WAYPOINT_COLORS.blue.bg;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
              style={{ backgroundColor: currentColor }}
            >
              {status === "completed" ? "✓" : status === "failed" ? "✗" : status === "skipped" ? "→" : idx + 1}
            </div>
            <span>Étape {idx + 1}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name */}
          <div>
            <label className="text-sm font-medium text-slate-600 mb-1 block">Nom</label>
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Nom de l'étape"
            />
            <p className="text-xs text-slate-400 mt-1 line-clamp-2">{wp.address}</p>
          </div>

          {/* Note */}
          <div>
            <label className="text-sm font-medium text-slate-600 mb-1 block flex items-center gap-2">
              <StickyNote className="w-4 h-4" />
              Note
            </label>
            <Textarea
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              placeholder="Code porte, instructions..."
              rows={2}
              className="resize-none"
            />
          </div>

          {/* Color picker */}
          <div>
            <label className="text-sm font-medium text-slate-600 mb-2 block flex items-center gap-2">
              <Palette className="w-4 h-4" />
              Couleur
            </label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(WAYPOINT_COLORS).map(([key, { bg, label }]) => (
                <button
                  key={key}
                  onClick={() => setEditColor(key)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${editColor === key ? "border-slate-900 scale-110 ring-2 ring-offset-1 ring-slate-400" : "border-transparent hover:scale-105"
                    }`}
                  style={{ backgroundColor: bg }}
                  title={label}
                />
              ))}
            </div>
          </div>

          {/* Status buttons */}
          <div>
            <label className="text-sm font-medium text-slate-600 mb-2 block">Statut</label>
            {status === "pending" ? (
              <div className="grid grid-cols-3 gap-2">
                <Button
                  onClick={() => handleStatusChange("completed")}
                  className="bg-green-500 hover:bg-green-600 text-white h-10"
                  disabled={saving}
                >
                  <Check className="w-4 h-4 mr-1" />
                  <span className="hidden sm:inline">Valider</span>
                  <span className="sm:hidden">OK</span>
                </Button>
                <Button
                  onClick={() => handleStatusChange("failed")}
                  className="bg-red-500 hover:bg-red-600 text-white h-10"
                  disabled={saving}
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  <span className="hidden sm:inline">Échec</span>
                  <span className="sm:hidden">KO</span>
                </Button>
                <Button
                  onClick={() => handleStatusChange("skipped")}
                  className="bg-slate-400 hover:bg-slate-500 text-white h-10"
                  disabled={saving}
                >
                  <SkipForward className="w-4 h-4 mr-1" />
                  <span className="hidden sm:inline">Ignorer</span>
                  <span className="sm:hidden">Skip</span>
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-md"
                  style={{ backgroundColor: `${currentColor}15` }}
                >
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: currentColor }} />
                  <span className="font-medium text-sm" style={{ color: currentColor }}>
                    {STATUS_LABELS[status]}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusChange("pending")}
                  disabled={saving}
                >
                  <Undo2 className="w-3 h-3 mr-1" />
                  Réinitialiser
                </Button>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-2">
          <Button
            variant="destructive"
            onClick={() => { onDelete(wp.id); onClose(); }}
            className="sm:mr-auto"
            size="sm"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Supprimer
          </Button>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={onClose} className="flex-1 sm:flex-initial">
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1 sm:flex-initial">
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Enregistrer
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Sortable Waypoint Item
function SortableWaypointItem({ wp, idx, isCurrentStop, onClick }) {
  const status = wp.status || "pending";
  const waypointColor = WAYPOINT_COLORS[wp.color || "blue"]?.bg || WAYPOINT_COLORS.blue.bg;
  const displayColor = STATUS_COLORS[status] || waypointColor;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: wp.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1,
  };

  const getStatusIcon = () => {
    if (status === "completed") return "✓";
    if (status === "failed") return "✗";
    if (status === "skipped") return "→";
    return idx + 1;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`waypoint-item-compact ${isCurrentStop ? "ring-2 ring-blue-500 ring-offset-1" : ""} ${status !== "pending" ? "opacity-60" : ""}`}
      data-testid={`waypoint-${wp.id}`}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 hover:bg-slate-200 rounded flex-shrink-0 touch-none"
      >
        <GripVertical className="w-4 h-4 text-slate-400" />
      </div>

      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
        style={{ backgroundColor: displayColor }}
      >
        {getStatusIcon()}
      </div>

      <div
        className="flex-1 min-w-0 mx-2 cursor-pointer"
        onClick={onClick}
      >
        <div className="font-medium text-sm truncate flex items-center gap-1">
          <span className="truncate">{wp.name}</span>
          {isCurrentStop && (
            <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap">
              En cours
            </span>
          )}
          {wp.note && <StickyNote className="w-3 h-3 text-amber-500 flex-shrink-0" />}
        </div>
        {status !== "pending" && (
          <div className="text-xs" style={{ color: displayColor }}>
            {STATUS_LABELS[status]}
          </div>
        )}
      </div>

      <button
        onClick={onClick}
        className="p-1.5 hover:bg-slate-200 rounded flex-shrink-0"
      >
        <Pencil className="w-4 h-4 text-slate-400" />
      </button>
    </div>
  );
}

export default function RouteOptimizer() {
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchAddress, setSearchAddress] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [newRouteName, setNewRouteName] = useState("");
  const [isNewRouteDialogOpen, setIsNewRouteDialogOpen] = useState(false);
  const [addressType, setAddressType] = useState("waypoint");
  const [currentWaypointIndex, setCurrentWaypointIndex] = useState(0);
  const [selectedWaypoint, setSelectedWaypoint] = useState(null);
  const [selectedWaypointIndex, setSelectedWaypointIndex] = useState(0);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const suggestionsRef = useRef(null);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    fetchRoutes();
  }, [fetchRoutes]);


  useEffect(() => {
    if (selectedRoute?.waypoints) {
      const firstPending = selectedRoute.waypoints.findIndex(
        wp => wp.status === "pending" || !wp.status
      );
      setCurrentWaypointIndex(firstPending >= 0 ? firstPending : 0);
    }
  }, [selectedRoute?.waypoints]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target) &&
        inputRef.current && !inputRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchRoutes = useCallback(async () => {
    try {
      const response = await fetch(`${API}/routes`);
      if (response.ok) {
        const data = await response.json();
        setRoutes(data);
        if (data.length > 0 && !selectedRoute) {
          setSelectedRoute(data[0]);
        }
      }
    } catch (error) {
      console.error("Error fetching routes:", error);
    }
  }, [selectedRoute]);


  const fetchSuggestions = async (text) => {
    if (!text || text.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    try {
      const response = await fetch(`${API}/autocomplete?text=${encodeURIComponent(text)}`);
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.suggestions || []);
        setShowSuggestions(data.suggestions?.length > 0);
        setSelectedSuggestionIndex(-1);
      }
    } catch (error) {
      console.error("Autocomplete error:", error);
    }
  };

  const handleSearchChange = (value) => {
    setSearchAddress(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(value), 300);
  };

  const handleKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === "Enter") handleAddAddress();
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedSuggestionIndex(prev => prev < suggestions.length - 1 ? prev + 1 : prev);
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case "Enter":
        e.preventDefault();
        if (selectedSuggestionIndex >= 0) selectSuggestion(suggestions[selectedSuggestionIndex]);
        else handleAddAddress();
        break;
      case "Escape":
        setShowSuggestions(false);
        break;
      default:
        break;
    }
  };

  const selectSuggestion = async (suggestion) => {
    setSearchAddress(suggestion.name);
    setSuggestions([]);
    setShowSuggestions(false);
    if (!selectedRoute) return;

    try {
      setLoading(true);
      const waypointData = {
        id: `wp-${Date.now()}`,
        name: suggestion.name,
        address: suggestion.address,
        coordinates: suggestion.coordinates,
        status: "pending",
        color: "blue",
      };

      let updatedRoute;
      if (addressType === "start") {
        const response = await fetch(`${API}/routes/${selectedRoute.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ start: waypointData }),
        });
        updatedRoute = await response.json();
      } else if (addressType === "end") {
        const response = await fetch(`${API}/routes/${selectedRoute.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ end: waypointData }),
        });
        updatedRoute = await response.json();
      } else {
        const response = await fetch(`${API}/routes/${selectedRoute.id}/waypoints`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(waypointData),
        });
        updatedRoute = await response.json();
      }

      setSelectedRoute(updatedRoute);
      setRoutes(routes.map((r) => (r.id === updatedRoute.id ? updatedRoute : r)));
      setSearchAddress("");
      toast.success("Adresse ajoutée");
    } catch (error) {
      toast.error("Erreur lors de l'ajout");
    } finally {
      setLoading(false);
    }
  };

  const createNewRoute = async () => {
    if (!newRouteName.trim()) {
      toast.error("Veuillez entrer un nom");
      return;
    }
    try {
      setLoading(true);
      const response = await fetch(`${API}/routes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newRouteName,
          start: { name: "Départ", address: "", coordinates: { longitude: 2.3522, latitude: 48.8566 } },
          end: { name: "Arrivée", address: "", coordinates: { longitude: 2.3522, latitude: 48.8566 } },
          waypoints: [],
          profile: "driving-car",
        }),
      });
      if (response.ok) {
        const newRoute = await response.json();
        setRoutes([...routes, newRoute]);
        setSelectedRoute(newRoute);
        setNewRouteName("");
        setIsNewRouteDialogOpen(false);
        toast.success("Itinéraire créé");
      }
    } catch (error) {
      toast.error("Erreur");
    } finally {
      setLoading(false);
    }
  };

  const deleteRoute = async (routeId) => {
    try {
      const response = await fetch(`${API}/routes/${routeId}`, { method: "DELETE" });
      if (response.ok) {
        const newRoutes = routes.filter((r) => r.id !== routeId);
        setRoutes(newRoutes);
        if (selectedRoute?.id === routeId) {
          setSelectedRoute(newRoutes.length > 0 ? newRoutes[0] : null);
        }
        toast.success("Supprimé");
      }
    } catch (error) {
      toast.error("Erreur");
    }
  };

  const geocodeAddress = async (address) => {
    if (!address.trim()) return null;
    setSearchLoading(true);
    try {
      const response = await fetch(`${API}/geocode?address=${encodeURIComponent(address)}`);
      if (response.ok) return await response.json();
      return null;
    } catch (error) {
      return null;
    } finally {
      setSearchLoading(false);
    }
  };

  const handleAddAddress = async () => {
    if (!selectedRoute || !searchAddress.trim()) return;
    const geocoded = await geocodeAddress(searchAddress);
    if (!geocoded) {
      toast.error("Adresse non trouvée");
      return;
    }
    try {
      setLoading(true);
      let updatedRoute;
      const data = {
        id: `wp-${Date.now()}`,
        name: geocoded.name,
        address: geocoded.address,
        coordinates: geocoded.coordinates,
        status: "pending",
        color: "blue",
      };

      if (addressType === "start") {
        const response = await fetch(`${API}/routes/${selectedRoute.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ start: data }),
        });
        updatedRoute = await response.json();
      } else if (addressType === "end") {
        const response = await fetch(`${API}/routes/${selectedRoute.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ end: data }),
        });
        updatedRoute = await response.json();
      } else {
        const response = await fetch(`${API}/routes/${selectedRoute.id}/waypoints`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        updatedRoute = await response.json();
      }

      setSelectedRoute(updatedRoute);
      setRoutes(routes.map((r) => (r.id === updatedRoute.id ? updatedRoute : r)));
      setSearchAddress("");
      setShowSuggestions(false);
      toast.success("Adresse ajoutée");
    } catch (error) {
      toast.error("Erreur");
    } finally {
      setLoading(false);
    }
  };

  const removeWaypoint = async (waypointId) => {
    if (!selectedRoute) return;
    try {
      const response = await fetch(`${API}/routes/${selectedRoute.id}/waypoints/${waypointId}`, { method: "DELETE" });
      if (response.ok) {
        const updatedRoute = await response.json();
        setSelectedRoute(updatedRoute);
        setRoutes(routes.map((r) => (r.id === updatedRoute.id ? updatedRoute : r)));
        toast.success("Supprimé");
      }
    } catch (error) {
      toast.error("Erreur");
    }
  };

  const updateWaypoint = async (waypointId, updates) => {
    if (!selectedRoute) return;
    try {
      const response = await fetch(`${API}/routes/${selectedRoute.id}/waypoints/${waypointId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (response.ok) {
        const updatedRoute = await response.json();
        setSelectedRoute(updatedRoute);
        setRoutes(routes.map((r) => (r.id === updatedRoute.id ? updatedRoute : r)));
        if (updates.status === "completed") toast.success("✅ Livré");
        else if (updates.status === "failed") toast.success("❌ Échec");
        else if (updates.status === "skipped") toast.success("⏭️ Ignoré");
        else toast.success("Mis à jour");
      }
    } catch (error) {
      toast.error("Erreur");
    }
  };

  const undoLastAction = async () => {
    if (!selectedRoute) return;
    try {
      const response = await fetch(`${API}/routes/${selectedRoute.id}/undo`, { method: "POST" });
      if (response.ok) {
        const updatedRoute = await response.json();
        setSelectedRoute(updatedRoute);
        setRoutes(routes.map((r) => (r.id === updatedRoute.id ? updatedRoute : r)));
        toast.success("Annulé");
      }
    } catch (error) {
      toast.error("Erreur");
    }
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !selectedRoute) return;

    const oldIndex = selectedRoute.waypoints.findIndex(wp => wp.id === active.id);
    const newIndex = selectedRoute.waypoints.findIndex(wp => wp.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newWaypoints = arrayMove(selectedRoute.waypoints, oldIndex, newIndex);
    const updatedRoute = { ...selectedRoute, waypoints: newWaypoints };
    setSelectedRoute(updatedRoute);
    setRoutes(routes.map((r) => (r.id === updatedRoute.id ? updatedRoute : r)));

    try {
      const response = await fetch(`${API}/routes/${selectedRoute.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ waypoints: newWaypoints }),
      });
      if (response.ok) {
        const serverRoute = await response.json();
        setSelectedRoute(serverRoute);
        setRoutes(routes.map((r) => (r.id === serverRoute.id ? serverRoute : r)));
        toast.success("Ordre mis à jour");
      }
    } catch (error) {
      toast.error("Erreur");
      fetchRoutes();
    }
  };

  const calculateRoute = async () => {
    if (!selectedRoute) return;
    try {
      setLoading(true);
      const response = await fetch(`${API}/routes/${selectedRoute.id}/calculate`, { method: "POST" });
      if (response.ok) {
        const updatedRoute = await response.json();
        setSelectedRoute(updatedRoute);
        setRoutes(routes.map((r) => (r.id === updatedRoute.id ? updatedRoute : r)));
        toast.success("Calculé");
      } else {
        toast.error("Erreur");
      }
    } catch (error) {
      toast.error("Erreur");
    } finally {
      setLoading(false);
    }
  };

  const optimizeRoute = async () => {
    if (!selectedRoute || selectedRoute.waypoints.length < 2) {
      toast.error("Min 2 étapes");
      return;
    }
    try {
      setLoading(true);
      const response = await fetch(`${API}/routes/${selectedRoute.id}/optimize`, { method: "POST" });
      if (response.ok) {
        const updatedRoute = await response.json();
        setSelectedRoute(updatedRoute);
        setRoutes(routes.map((r) => (r.id === updatedRoute.id ? updatedRoute : r)));
        toast.success("Optimisé!");
      } else {
        toast.error("Erreur");
      }
    } catch (error) {
      toast.error("Erreur");
    } finally {
      setLoading(false);
    }
  };

  const changeProfile = async (profile) => {
    if (!selectedRoute) return;
    try {
      const response = await fetch(`${API}/routes/${selectedRoute.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
      });
      if (response.ok) {
        const updatedRoute = await response.json();
        setSelectedRoute(updatedRoute);
        setRoutes(routes.map((r) => (r.id === updatedRoute.id ? updatedRoute : r)));
      }
    } catch (error) { }
  };

  const getMarkers = useCallback(() => {
    if (!selectedRoute) return [];
    const markers = [];
    if (selectedRoute.start?.coordinates) {
      markers.push({
        lat: selectedRoute.start.coordinates.latitude,
        lng: selectedRoute.start.coordinates.longitude,
        type: "start",
        name: selectedRoute.start.name || "Départ",
        address: selectedRoute.start.address,
      });
    }
    selectedRoute.waypoints?.forEach((wp, idx) => {
      const status = wp.status || "pending";
      const waypointColor = WAYPOINT_COLORS[wp.color || "blue"]?.bg || WAYPOINT_COLORS.blue.bg;
      markers.push({
        lat: wp.coordinates.latitude,
        lng: wp.coordinates.longitude,
        type: "waypoint",
        name: wp.name,
        address: wp.address,
        index: idx + 1,
        id: wp.id,
        status,
        color: STATUS_COLORS[status] || waypointColor,
      });
    });
    if (selectedRoute.end?.coordinates) {
      markers.push({
        lat: selectedRoute.end.coordinates.latitude,
        lng: selectedRoute.end.coordinates.longitude,
        type: "end",
        name: selectedRoute.end.name || "Arrivée",
        address: selectedRoute.end.address,
      });
    }
    return markers;
  }, [selectedRoute]);

  const getRouteCoords = useCallback(() => {
    if (!selectedRoute?.geometry?.coordinates) return [];
    return selectedRoute.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
  }, [selectedRoute]);

  const formatDistance = (m) => !m ? "-" : m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
  const formatDuration = (s) => {
    if (!s) return "-";
    const h = Math.floor(s / 3600);
    const m = Math.round((s % 3600) / 60);
    return h > 0 ? `${h}h${m}min` : `${m} min`;
  };

  const getProgress = () => {
    if (!selectedRoute?.waypoints?.length) return { completed: 0, total: 0 };
    const completed = selectedRoute.waypoints.filter(wp => wp.status && wp.status !== "pending").length;
    return { completed, total: selectedRoute.waypoints.length };
  };

  const markers = getMarkers();
  const routeCoords = getRouteCoords();
  const progress = getProgress();

  return (
    <div className="route-optimizer" data-testid="route-optimizer">
      {selectedWaypoint && (
        <WaypointDetailDialog
          wp={selectedWaypoint}
          idx={selectedWaypointIndex}
          isOpen={!!selectedWaypoint}
          onClose={() => setSelectedWaypoint(null)}
          onUpdate={updateWaypoint}
          onDelete={removeWaypoint}
        />
      )}

      {/* Sidebar */}
      <div className="sidebar" data-testid="sidebar">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2" style={{ fontFamily: "Manrope" }}>
              <Route className="w-5 h-5 text-blue-500" />
              <span className="hidden sm:inline">Route Optimizer</span>
              <span className="sm:hidden">Routes</span>
            </h1>
          </div>

          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">Itinéraires</span>
            <Dialog open={isNewRouteDialogOpen} onOpenChange={setIsNewRouteDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="h-8" data-testid="new-route-btn">
                  <FolderPlus className="w-4 h-4 mr-1" />
                  <span className="hidden sm:inline">Nouveau</span>
                  <span className="sm:hidden">+</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Nouvel itinéraire</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <Input
                    placeholder="Nom"
                    value={newRouteName}
                    onChange={(e) => setNewRouteName(e.target.value)}
                    data-testid="route-name-input"
                  />
                  <Button onClick={createNewRoute} className="w-full bg-slate-900" disabled={loading} data-testid="create-route-btn">
                    {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Créer
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <ScrollArea className="h-24">
            {routes.length === 0 ? (
              <div className="text-center py-3 text-slate-400 text-sm">Aucun itinéraire</div>
            ) : (
              routes.map((route) => (
                <div
                  key={route.id}
                  className={`route-card ${selectedRoute?.id === route.id ? "active" : ""}`}
                  onClick={() => setSelectedRoute(route)}
                  data-testid={`route-card-${route.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center min-w-0">
                      <Navigation className="w-4 h-4 mr-2 text-blue-500 flex-shrink-0" />
                      <span className="font-medium truncate">{route.name}</span>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-slate-400 hover:text-red-500 flex-shrink-0"
                      onClick={(e) => { e.stopPropagation(); deleteRoute(route.id); }}
                      data-testid={`delete-route-${route.id}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">{route.waypoints?.length || 0} étapes</div>
                </div>
              ))
            )}
          </ScrollArea>
        </div>

        {selectedRoute && (
          <div className="p-4">
            <div className="mb-3">
              <div className="profile-toggle">
                <button
                  className={`profile-btn ${selectedRoute.profile === "driving-car" ? "active" : ""}`}
                  onClick={() => changeProfile("driving-car")}
                  data-testid="profile-car-btn"
                >
                  <Car className="w-4 h-4" />
                  <span className="hidden sm:inline">Voiture</span>
                </button>
                <button
                  className={`profile-btn ${selectedRoute.profile === "foot-walking" ? "active" : ""}`}
                  onClick={() => changeProfile("foot-walking")}
                  data-testid="profile-walk-btn"
                >
                  <Footprints className="w-4 h-4" />
                  <span className="hidden sm:inline">À pied</span>
                </button>
              </div>
            </div>

            {(selectedRoute.distance || selectedRoute.duration) && (
              <div className="stats-bar mb-3" data-testid="stats-bar">
                <div className="stat-item">
                  <span className="stat-label">Distance</span>
                  <span className="stat-value">{formatDistance(selectedRoute.distance)}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Durée</span>
                  <span className="stat-value">{formatDuration(selectedRoute.duration)}</span>
                </div>
                {progress.total > 0 && (
                  <div className="stat-item">
                    <span className="stat-label">Fait</span>
                    <span className="stat-value">{progress.completed}/{progress.total}</span>
                  </div>
                )}
              </div>
            )}

            <div className="mb-3">
              <div className="flex gap-2 mb-2">
                <select
                  value={addressType}
                  onChange={(e) => setAddressType(e.target.value)}
                  className="h-9 px-2 rounded-md border border-slate-200 text-sm bg-white flex-shrink-0"
                  data-testid="address-type-select"
                >
                  <option value="start">A</option>
                  <option value="waypoint">+</option>
                  <option value="end">B</option>
                </select>
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
                  <Input
                    ref={inputRef}
                    placeholder="Adresse..."
                    value={searchAddress}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                    className="pl-8 h-9 text-sm"
                    data-testid="address-input"
                    autoComplete="off"
                  />
                  {showSuggestions && suggestions.length > 0 && (
                    <div ref={suggestionsRef} className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                      {suggestions.map((s, i) => (
                        <div
                          key={i}
                          className={`px-3 py-2 cursor-pointer border-b border-slate-100 last:border-b-0 ${i === selectedSuggestionIndex ? "bg-blue-50" : "hover:bg-slate-50"}`}
                          onClick={() => selectSuggestion(s)}
                          data-testid={`suggestion-${i}`}
                        >
                          <div className="font-medium text-sm text-slate-900 truncate">{s.name}</div>
                          <div className="text-xs text-slate-500 truncate">{s.address}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <Button onClick={handleAddAddress} disabled={searchLoading || !searchAddress.trim()} className="bg-blue-500 hover:bg-blue-600 h-9 w-9 p-0" data-testid="add-address-btn">
                  {searchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {selectedRoute.waypoints?.some(wp => wp.status && wp.status !== "pending") && (
              <Button variant="outline" size="sm" onClick={undoLastAction} className="w-full mb-3 border-orange-300 text-orange-600 hover:bg-orange-50 h-8" data-testid="undo-btn">
                <Undo2 className="w-3 h-3 mr-1" />
                Annuler
              </Button>
            )}

            <div className="mb-3">
              <div className="text-sm font-medium text-slate-600 mb-2 flex items-center justify-between">
                <span>Étapes ({selectedRoute.waypoints?.length || 0})</span>
                <span className="text-xs text-slate-400">Cliquez pour modifier</span>
              </div>
              <ScrollArea className="h-40 sm:h-52">
                {selectedRoute.start?.address && (
                  <div className="waypoint-item-compact" data-testid="start-point">
                    <div className="w-5 flex-shrink-0" />
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0 bg-green-500">A</div>
                    <div className="flex-1 min-w-0 mx-2">
                      <div className="font-medium text-sm truncate">{selectedRoute.start.name}</div>
                    </div>
                  </div>
                )}

                {selectedRoute.waypoints?.length > 0 && (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={selectedRoute.waypoints.map(wp => wp.id)} strategy={verticalListSortingStrategy}>
                      {selectedRoute.waypoints.map((wp, idx) => (
                        <SortableWaypointItem
                          key={wp.id}
                          wp={wp}
                          idx={idx}
                          isCurrentStop={idx === currentWaypointIndex && (wp.status === "pending" || !wp.status)}
                          onClick={() => { setSelectedWaypoint(wp); setSelectedWaypointIndex(idx); }}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                )}

                {selectedRoute.end?.address && (
                  <div className="waypoint-item-compact" data-testid="end-point">
                    <div className="w-5 flex-shrink-0" />
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0 bg-red-500">B</div>
                    <div className="flex-1 min-w-0 mx-2">
                      <div className="font-medium text-sm truncate">{selectedRoute.end.name}</div>
                    </div>
                  </div>
                )}

                {!selectedRoute.start?.address && !selectedRoute.end?.address && selectedRoute.waypoints?.length === 0 && (
                  <div className="empty-state py-6">
                    <MapPin className="w-8 h-8" />
                    <p className="text-sm">Ajoutez des adresses</p>
                  </div>
                )}
              </ScrollArea>
            </div>

            <div className="space-y-2">
              <Button onClick={calculateRoute} disabled={loading} className="w-full bg-slate-900 hover:bg-slate-800 h-10" data-testid="calculate-btn">
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Navigation className="w-4 h-4 mr-2" />}
                Calculer
              </Button>
              <Button onClick={optimizeRoute} disabled={loading || (selectedRoute.waypoints?.length || 0) < 2} variant="outline" className="w-full h-10 border-blue-500 text-blue-600 hover:bg-blue-50" data-testid="optimize-btn">
                <Sparkles className="w-4 h-4 mr-2" />
                Optimiser
              </Button>
            </div>
          </div>
        )}

        {!selectedRoute && routes.length === 0 && (
          <div className="p-4">
            <div className="empty-state">
              <Route className="w-10 h-10 text-slate-300" />
              <h3 className="font-medium text-slate-600 mt-3">Aucun itinéraire</h3>
              <p className="text-sm text-slate-400 mt-1">Créez-en un pour commencer</p>
            </div>
          </div>
        )}
      </div>

      {/* Map */}
      <div className="map-container" data-testid="map-container">
        <MapContainer center={[48.8566, 2.3522]} zoom={12} style={{ height: "100%", width: "100%" }}>
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {markers.length > 0 && <MapBoundsUpdater markers={markers} />}
          {routeCoords.length > 0 && <Polyline positions={routeCoords} color="#3b82f6" weight={4} opacity={0.8} />}
          {markers.map((marker, idx) => {
            const color = marker.type === "start" ? "#22c55e" : marker.type === "end" ? "#ef4444" : marker.color || "#3b82f6";
            const opacity = marker.status === "completed" || marker.status === "failed" || marker.status === "skipped" ? 0.5 : 1;
            return (
              <Marker
                key={`${marker.type}-${idx}`}
                position={[marker.lat, marker.lng]}
                icon={createIcon(
                  color,
                  marker.type === "start" ? "A" : marker.type === "end" ? "B" : marker.status === "completed" ? "✓" : marker.status === "failed" ? "✗" : marker.status === "skipped" ? "→" : marker.index,
                  opacity
                )}
              >
                <Popup>
                  <div className="text-sm">
                    <p className="font-semibold">{marker.name}</p>
                    <p className="text-slate-500 text-xs">{marker.address}</p>
                    {marker.status && <p className="mt-1 text-xs" style={{ color }}>{STATUS_LABELS[marker.status]}</p>}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}
