import { useId, useMemo, useState } from "react";
import { geoGraticule10, geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import atlas from "world-atlas/countries-110m.json";
import { Minus, Plus, RotateCcw, ScanLine } from "lucide-react";
import type { Country } from "./types";
import "./world-map.css";

interface Props {
  countries: Country[];
  player: string;
  selected: string;
  onSelect: (id: string) => void;
  cooperation: boolean;
}

const ISO_NUMERIC: Record<string, string> = {
  US: "840",
  CN: "156",
  JP: "392",
  DE: "276",
  GB: "826",
  KR: "410",
  FR: "250",
  IN: "356",
};

const LABEL_OFFSETS: Record<string, [number, number]> = {
  US: [-18, 30],
  CN: [-18, -24],
  JP: [23, 10],
  KR: [12, -26],
  DE: [33, 15],
  GB: [-37, -24],
  FR: [-34, 27],
  IN: [10, 30],
};

// 地图只负责展示，科技强度与合作状态均来自同一份世界状态。
const worldFeatures = feature(
  atlas as unknown as Topology<{ countries: GeometryCollection }>,
  atlas.objects.countries as GeometryCollection,
) as FeatureCollection;

const projection = geoNaturalEarth1().fitExtent(
  [
    [25, 12],
    [975, 453],
  ],
  { type: "Sphere" },
);
const path = geoPath(projection);
const spherePath = path({ type: "Sphere" }) ?? "";
const gridPath = path(geoGraticule10()) ?? "";

function projected(coordinates: [number, number]): [number, number] {
  return projection(coordinates) ?? [0, 0];
}

function connection(from: [number, number], to: [number, number]): string {
  const [x1, y1] = projected(from);
  const [x2, y2] = projected(to);
  const rise = Math.min(105, Math.abs(x2 - x1) * 0.2 + 14);
  return `M${x1},${y1} Q${(x1 + x2) / 2},${Math.min(y1, y2) - rise} ${x2},${y2}`;
}

export default function WorldMap({
  countries,
  player,
  selected,
  onSelect,
  cooperation,
}: Props) {
  const [zoom, setZoom] = useState(1);
  const [hovered, setHovered] = useState<string | null>(null);
  const uid = useId().replace(/:/g, "");
  const byNumeric = useMemo(
    () =>
      new Map(countries.map((country) => [ISO_NUMERIC[country.id], country])),
    [countries],
  );
  const playerCountry = countries.find((country) => country.id === player);
  const selectedCountry = countries.find((country) => country.id === selected);
  const selectedPoint = projected(selectedCountry?.coordinates ?? [0, 0]);
  const focus = zoom > 1 ? selectedPoint : [500, 235];
  const transform = `translate(500 235) scale(${zoom}) translate(${-focus[0]} ${-focus[1]})`;
  const cooperationCountries = countries.filter(
    (country) => country.id !== player,
  );

  return (
    <div className="world-map" aria-label="全球科技竞争地图">
      <div className="world-map-coordinate">
        <ScanLine size={12} />
        <span>全球科研网络</span>
        <span className="world-map-coordinate-value">实时模拟</span>
      </div>
      <div className="world-map-controls" aria-label="地图缩放">
        <button
          type="button"
          onClick={() => setZoom((value) => Math.min(2.4, value + 0.35))}
          disabled={zoom >= 2.4}
          title="放大地图"
          aria-label="放大地图"
        >
          <Plus size={15} />
        </button>
        <button
          type="button"
          onClick={() => setZoom((value) => Math.max(1, value - 0.35))}
          disabled={zoom <= 1}
          title="缩小地图"
          aria-label="缩小地图"
        >
          <Minus size={15} />
        </button>
        <button
          type="button"
          onClick={() => setZoom(1)}
          title="复位地图"
          aria-label="复位地图"
        >
          <RotateCcw size={13} />
        </button>
      </div>
      <svg
        viewBox="0 0 1000 470"
        className="world-map-svg"
        role="img"
        aria-label="点击地图上的国家，查看科技实力"
      >
        <defs>
          <radialGradient id={`${uid}-ocean`} cx="54%" cy="42%" r="64%">
            <stop offset="0%" stopColor="#192b37" />
            <stop offset="100%" stopColor="#111d25" />
          </radialGradient>
          <radialGradient id={`${uid}-hub`}>
            <stop offset="0%" stopColor="#8cdce1" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#8cdce1" stopOpacity="0" />
          </radialGradient>
          <clipPath id={`${uid}-clip`}>
            <rect width="1000" height="470" />
          </clipPath>
          <filter id={`${uid}-soft`}>
            <feGaussianBlur stdDeviation="2.4" />
          </filter>
        </defs>
        <rect width="1000" height="470" fill={`url(#${uid}-ocean)`} />
        <g clipPath={`url(#${uid}-clip)`}>
          <g transform={transform}>
            <path
              d={spherePath}
              fill="none"
              stroke="#334653"
              strokeWidth="0.7"
              opacity="0.3"
            />
            <path
              d={gridPath}
              fill="none"
              stroke="#50616c"
              strokeWidth="0.55"
              opacity="0.22"
            />
            {worldFeatures.features.map((geo, index) => {
              const country = byNumeric.get(String(geo.id));
              const active = country?.id === selected;
              const home = country?.id === player;
              const isUS = country?.id === "US";
              const hover = country?.id === hovered;
              const fill = active
                ? "#39717a"
                : home
                  ? "#2e5863"
                  : isUS
                    ? "#514d3e"
                    : country
                      ? "#2b404e"
                      : "#25343d";
              const select = () => country && onSelect(country.id);
              return (
                <path
                  key={geo.id ?? geo.properties?.name ?? index}
                  d={path(geo) ?? ""}
                  fill={fill}
                  stroke={active || hover ? "#86c5cc" : "#142630"}
                  strokeWidth={active || hover ? 1 : 0.65}
                  className={
                    country
                      ? "world-map-country interactive"
                      : "world-map-country"
                  }
                  role={country ? "button" : undefined}
                  tabIndex={country ? 0 : undefined}
                  aria-label={
                    country ? `查看${country.name}科技实力` : undefined
                  }
                  onClick={select}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      select();
                    }
                  }}
                  onMouseEnter={() => country && setHovered(country.id)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <title>
                    {country
                      ? `${country.name} · ${country.id === player ? "玩家国家" : "AI 自主发展"}`
                      : String(geo.properties?.name ?? "")}
                  </title>
                </path>
              );
            })}
            {playerCountry &&
              cooperation &&
              cooperationCountries.map((country) => (
                <path
                  key={`line-${country.id}`}
                  d={connection(playerCountry.coordinates, country.coordinates)}
                  fill="none"
                  stroke={country.id === "US" ? "#b49d69" : "#63a5ad"}
                  strokeWidth="0.9"
                  strokeDasharray="3 5"
                  opacity={country.id === selected ? 0.65 : 0.33}
                  className="world-map-connection"
                />
              ))}
            {countries.map((country) => {
              const [x, y] = projected(country.coordinates);
              const active = country.id === selected;
              const home = country.id === player;
              const [dx, dy] = LABEL_OFFSETS[country.id] ?? [10, -15];
              const color = home
                ? "#8dd8de"
                : country.id === "US"
                  ? "#d7bc80"
                  : "#8da8ba";
              const labelX = x + dx;
              const labelY = y + dy;
              return (
                <g
                  key={country.id}
                  className="world-map-marker"
                  onClick={() => onSelect(country.id)}
                  role="button"
                  tabIndex={0}
                  aria-label={`选择${country.name}`}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect(country.id);
                    }
                  }}
                >
                  <circle
                    cx={x}
                    cy={y}
                    r={home ? 30 : 18}
                    fill={`url(#${uid}-hub)`}
                  />
                  {(active || home) && (
                    <circle
                      cx={x}
                      cy={y}
                      r={home ? 10 : 8}
                      fill="none"
                      stroke={color}
                      strokeWidth="0.7"
                      opacity="0.4"
                      className={home ? "world-map-pulse" : undefined}
                    />
                  )}
                  <circle cx={x} cy={y} r={home ? 3.4 : 2.5} fill={color} />
                  <circle cx={x} cy={y} r="1.1" fill="#e9f6f2" />
                  <path
                    d={`M${x},${y + (dy > 0 ? 5 : -5)} L${labelX},${labelY + (dy > 0 ? -7 : 5)}`}
                    fill="none"
                    stroke={color}
                    strokeWidth="0.7"
                    opacity="0.5"
                  />
                  <text
                    x={labelX}
                    y={labelY}
                    fill={active || home ? "#d7eeee" : "#9db4c2"}
                    textAnchor="middle"
                    fontSize={home ? 12 : 11}
                    fontWeight={home ? 600 : 400}
                    className="world-map-label"
                  >
                    {country.name}
                  </text>
                  {home && (
                    <text
                      x={labelX}
                      y={labelY + 14}
                      fill="#70abb4"
                      textAnchor="middle"
                      fontSize="7.5"
                      letterSpacing="1.3"
                    >
                      国家科技战略总部
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </g>
        <path
          d="M20 38 V20 H38 M962 20 H980 V38 M20 432 V450 H38 M962 450 H980 V432"
          fill="none"
          stroke="#45616e"
          strokeWidth="1"
          opacity="0.6"
        />
      </svg>
      <div className="world-map-legend">
        <span>
          <i className="map-legend-home" />
          本国
        </span>
        <span>
          <i className="map-legend-hub" />
          科技枢纽
        </span>
        <span className={!cooperation ? "map-legend-inactive" : ""}>
          <i className="map-legend-line" />
          科研合作{!cooperation ? "（已关闭）" : ""}
        </span>
      </div>
      <span className="world-map-footnote">自然地理底图 · 科技节点示意</span>
    </div>
  );
}
