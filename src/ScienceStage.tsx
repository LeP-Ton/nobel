import { FIELD_META } from "./data";
import type { FieldId } from "./types";

const domains: FieldId[] = ["ai", "chips", "energy", "manufacturing", "bio"];

// 主菜单的科学装置展示五领域的相互依赖，不承载地理信息。
export default function ScienceStage() {
  const points = domains.map((field, index) => {
    const angle = ((index * 72 - 90) * Math.PI) / 180;
    return {
      field,
      x: 440 + Math.cos(angle) * 229,
      y: 345 + Math.sin(angle) * 229,
    };
  });
  return (
    <div className="science-stage" aria-hidden="true">
      <svg viewBox="0 0 880 730" fill="none">
        <defs>
          <radialGradient id="science-depth">
            <stop stopColor="#729da5" stopOpacity=".12" />
            <stop offset="1" stopColor="#729da5" stopOpacity="0" />
          </radialGradient>
          <linearGradient
            id="science-orbit"
            x1="170"
            y1="100"
            x2="710"
            y2="590"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#a7c4c6" stopOpacity=".7" />
            <stop offset=".5" stopColor="#5f868a" stopOpacity=".1" />
            <stop offset="1" stopColor="#cab382" stopOpacity=".6" />
          </linearGradient>
          <radialGradient id="science-core">
            <stop stopColor="#b0d9d7" stopOpacity=".8" />
            <stop offset=".16" stopColor="#83b7b9" stopOpacity=".2" />
            <stop offset="1" stopColor="#5d8c91" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="440" cy="345" r="310" fill="url(#science-depth)" />
        <g className="science-rings" stroke="url(#science-orbit)">
          <circle cx="440" cy="345" r="270" strokeWidth=".8" />
          <circle
            cx="440"
            cy="345"
            r="279"
            strokeWidth=".6"
            strokeDasharray="1 15"
          />
          <circle
            cx="440"
            cy="345"
            r="228"
            strokeWidth=".6"
            strokeDasharray="3 12"
          />
          <ellipse
            cx="440"
            cy="345"
            rx="267"
            ry="100"
            transform="rotate(-32 440 345)"
          />
          <ellipse
            cx="440"
            cy="345"
            rx="267"
            ry="100"
            transform="rotate(32 440 345)"
          />
          <ellipse
            cx="440"
            cy="345"
            rx="102"
            ry="267"
            transform="rotate(-23 440 345)"
          />
          <ellipse
            cx="440"
            cy="345"
            rx="102"
            ry="267"
            transform="rotate(23 440 345)"
          />
        </g>
        <path
          d="M95 345H785M440 30V660"
          stroke="#8cacb2"
          strokeOpacity=".15"
          strokeDasharray="3 9"
        />
        <circle cx="440" cy="345" r="85" fill="url(#science-core)" />
        <circle cx="440" cy="345" r="3" fill="#d4e4dc" />
        <circle cx="440" cy="345" r="12" stroke="#afd0cc" strokeOpacity=".6" />
        {points.map((point, index) => (
          <g key={point.field}>
            <path
              d={`M440 345L${point.x} ${point.y}`}
              stroke="#7aa6ad"
              strokeOpacity=".18"
            />
            {FIELD_META[point.field].dependencies.map((dependency) => {
              const other = points.find((p) => p.field === dependency)!;
              return (
                <path
                  key={dependency}
                  d={`M${point.x} ${point.y} Q440 345 ${other.x} ${other.y}`}
                  stroke="#97b9bd"
                  strokeOpacity=".16"
                  strokeDasharray="2 6"
                />
              );
            })}
            <circle
              cx={point.x}
              cy={point.y}
              r="6"
              fill="#17272c"
              stroke="#8aacac"
            />
            <circle cx={point.x} cy={point.y} r="2" fill="#c2d6ca" />
            <text
              x={point.x + (index === 4 || index === 3 ? -20 : 20)}
              y={point.y - 15}
              textAnchor={index === 4 || index === 3 ? "end" : "start"}
              fill="#9fb6ba"
              fontSize="11"
              letterSpacing="2"
            >
              {FIELD_META[point.field].name}
            </text>
            <text
              x={point.x + (index === 4 || index === 3 ? -20 : 20)}
              y={point.y + 1}
              textAnchor={index === 4 || index === 3 ? "end" : "start"}
              fill="#5d7b80"
              fontSize="8"
              letterSpacing="1"
            >
              RESEARCH DOMAIN 0{index + 1}
            </text>
          </g>
        ))}
        <path
          d="M155 80V65H170M710 65H725V80M155 610V625H170M710 625H725V610"
          stroke="#8b9e98"
          strokeOpacity=".45"
        />
        <text
          x="440"
          y="684"
          textAnchor="middle"
          fill="#7e9695"
          fontSize="9"
          letterSpacing="5"
        >
          THE ARCHITECTURE OF DISCOVERY
        </text>
      </svg>
      <span className="science-stage-caption">
        探索未知的边界，构筑文明的未来。
      </span>
    </div>
  );
}
