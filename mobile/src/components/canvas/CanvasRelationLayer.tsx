import React, { memo } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { G, Path, Circle, Polygon, Rect, Text as SvgText } from 'react-native-svg';
import { colors } from '../../theme/colors';
import { ComputedRelationshipPath } from '../../utils/diagramGeometry';

interface CanvasRelationLayerProps {
  paths: ComputedRelationshipPath[];
  deletionIds?:Set<string>;
}

/**
 * Capa de renderizado de Relaciones UML con arquitectura modular de SVGs independientes:
 * Cada relación calcula su propio bounding box ajustado y se renderiza en un <Svg>
 * liviano (~1-2 MB de textura máxima). Esto elimina de raíz la asignación de mapas de bits
 * gigantescos (243 MB) en Android que provocaban 'Canvas: trying to draw too large bitmap'.
 */
export const CanvasRelationLayer: React.FC<CanvasRelationLayerProps> = memo(({ paths,deletionIds }) => {
  if (!paths || paths.length === 0) return null;

  return (
    <>
      {paths.map((r) => {
        if (!r || !r.pathD || r.pathD.includes('NaN')) return null;
        if (
          !Number.isFinite(r.startX) ||
          !Number.isFinite(r.startY) ||
          !Number.isFinite(r.endX) ||
          !Number.isFinite(r.endY)
        ) {
          return null;
        }

        const isGhost = r.isGhostDraft;
        const strokeColor = deletionIds?.has(r.id) ? colors.error : colors.primary;

        // Marcador geométrico rotado según el ángulo de tangencia en el extremo destino (blindado contra NaN)
        const safeAngle = Number.isFinite(r.angle) ? r.angle : 0;
        const cos = Math.cos(safeAngle);
        const sin = Math.sin(safeAngle);

        // Vector perpendicular unitario
        const perpX = -sin;
        const perpY = cos;

        // Renderizado del marcador destino según el tipo UML
        let markerElement = null;

        if (r.markerType === 'inheritance') {
          // Triángulo hueco UML para Herencia / Generalización
          const size = 12;
          const baseWidth = 8;
          const p1X = r.endX;
          const p1Y = r.endY;
          const p2X = r.endX - cos * size + perpX * baseWidth;
          const p2Y = r.endY - sin * size + perpY * baseWidth;
          const p3X = r.endX - cos * size - perpX * baseWidth;
          const p3Y = r.endY - sin * size - perpY * baseWidth;

          if (
            Number.isFinite(p1X) && Number.isFinite(p1Y) &&
            Number.isFinite(p2X) && Number.isFinite(p2Y) &&
            Number.isFinite(p3X) && Number.isFinite(p3Y)
          ) {
            markerElement = (
              <Polygon
                points={`${p1X},${p1Y} ${p2X},${p2Y} ${p3X},${p3Y}`}
                fill={colors.surface}
                stroke={strokeColor}
                strokeWidth={1.8}
              />
            );
          }
        } else if (r.markerType === 'diamond') {
          // Rombo sólido para Composición
          const len = 14;
          const w = 7;
          const p1X = r.endX;
          const p1Y = r.endY;
          const p2X = r.endX - cos * (len / 2) + perpX * w;
          const p2Y = r.endY - sin * (len / 2) + perpY * w;
          const p3X = r.endX - cos * len;
          const p3Y = r.endY - sin * len;
          const p4X = r.endX - cos * (len / 2) - perpX * w;
          const p4Y = r.endY - sin * (len / 2) - perpY * w;

          if (
            Number.isFinite(p1X) && Number.isFinite(p1Y) &&
            Number.isFinite(p2X) && Number.isFinite(p2Y) &&
            Number.isFinite(p3X) && Number.isFinite(p3Y) &&
            Number.isFinite(p4X) && Number.isFinite(p4Y)
          ) {
            markerElement = (
              <Polygon
                points={`${p1X},${p1Y} ${p2X},${p2Y} ${p3X},${p3Y} ${p4X},${p4Y}`}
                fill={strokeColor}
                stroke={strokeColor}
                strokeWidth={1.5}
              />
            );
          }
        } else if (r.markerType === 'diamond-hollow') {
          // Rombo hueco para Agregación
          const len = 14;
          const w = 7;
          const p1X = r.endX;
          const p1Y = r.endY;
          const p2X = r.endX - cos * (len / 2) + perpX * w;
          const p2Y = r.endY - sin * (len / 2) + perpY * w;
          const p3X = r.endX - cos * len;
          const p3Y = r.endY - sin * len;
          const p4X = r.endX - cos * (len / 2) - perpX * w;
          const p4Y = r.endY - sin * (len / 2) - perpY * w;

          if (
            Number.isFinite(p1X) && Number.isFinite(p1Y) &&
            Number.isFinite(p2X) && Number.isFinite(p2Y) &&
            Number.isFinite(p3X) && Number.isFinite(p3Y) &&
            Number.isFinite(p4X) && Number.isFinite(p4Y)
          ) {
            markerElement = (
              <Polygon
                points={`${p1X},${p1Y} ${p2X},${p2Y} ${p3X},${p3Y} ${p4X},${p4Y}`}
                fill={colors.surface}
                stroke={strokeColor}
                strokeWidth={1.8}
              />
            );
          }
        } else {
          // Flecha abierta para Asociación navegable
          const arrowLen = 10;
          const arrowW = 6;
          const a1X = r.endX - cos * arrowLen + perpX * arrowW;
          const a1Y = r.endY - sin * arrowLen + perpY * arrowW;
          const a2X = r.endX - cos * arrowLen - perpX * arrowW;
          const a2Y = r.endY - sin * arrowLen - perpY * arrowW;

          if (
            Number.isFinite(a1X) && Number.isFinite(a1Y) &&
            Number.isFinite(r.endX) && Number.isFinite(r.endY) &&
            Number.isFinite(a2X) && Number.isFinite(a2Y)
          ) {
            markerElement = (
              <Path
                d={`M ${a1X} ${a1Y} L ${r.endX} ${r.endY} L ${a2X} ${a2Y}`}
                fill="none"
                stroke={strokeColor}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          }
        }

        // Bounding box dinámico ultra-liviano para esta relación individual
        const xs = [r.startX, r.endX, r.midX].filter(Number.isFinite);
        const ys = [r.startY, r.endY, r.midY].filter(Number.isFinite);

        if (r.sourceMultiplicity && Number.isFinite(r.srcMultX)) xs.push(r.srcMultX - 25, r.srcMultX + 25);
        if (r.sourceMultiplicity && Number.isFinite(r.srcMultY)) ys.push(r.srcMultY - 20, r.srcMultY + 20);

        if (r.targetMultiplicity && Number.isFinite(r.tgtMultX)) xs.push(r.tgtMultX - 25, r.tgtMultX + 25);
        if (r.targetMultiplicity && Number.isFinite(r.tgtMultY)) ys.push(r.tgtMultY - 20, r.tgtMultY + 20);

        if (r.name && Number.isFinite(r.midX)) xs.push(r.midX - 50, r.midX + 50);
        if (r.name && Number.isFinite(r.midY)) ys.push(r.midY - 25, r.midY + 25);

        const PADDING = 28;
        const minX = Math.floor(Math.min(...xs) - PADDING);
        const minY = Math.floor(Math.min(...ys) - PADDING);
        const maxX = Math.ceil(Math.max(...xs) + PADDING);
        const maxY = Math.ceil(Math.max(...ys) + PADDING);

        const width = Math.max(maxX - minX, 16);
        const height = Math.max(maxY - minY, 16);

        return (
          <Svg
            key={r.id}
            width={width}
            height={height}
            viewBox={`${minX} ${minY} ${width} ${height}`}
            style={[styles.relSvg, { left: minX, top: minY, width, height }]}
            pointerEvents="none"
          >
            <G>
              {/* Sombra de resplandor ambiental */}
              <Path
                d={r.pathD}
                stroke={isGhost ? 'rgba(232, 195, 158, 0.15)' : 'rgba(232, 195, 158, 0.18)'}
                strokeWidth={isGhost ? 5 : 4}
                fill="none"
              />

              {/* Línea principal Bézier */}
              <Path
                d={r.pathD}
                stroke={strokeColor}
                strokeWidth={isGhost ? 2 : 2.2}
                strokeDasharray={isGhost || r.type === 'dependency' ? '6, 4' : undefined}
                fill="none"
              />

              {/* Punto de origen circular */}
              <Circle cx={r.startX} cy={r.startY} r={3.2} fill={strokeColor} />

              {/* Marcador del destino */}
              {markerElement}

              {/* Multiplicidad Origen */}
              {r.sourceMultiplicity && Number.isFinite(r.srcMultX) && Number.isFinite(r.srcMultY) && (
                <G>
                  <Rect
                    x={r.srcMultX - 12}
                    y={r.srcMultY - 8}
                    width={24}
                    height={15}
                    rx={4}
                    fill="rgba(15, 23, 42, 0.90)"
                    stroke="rgba(232, 195, 158, 0.30)"
                    strokeWidth={0.8}
                  />
                  <SvgText
                    x={r.srcMultX}
                    y={r.srcMultY + 3}
                    fill="#ffffff"
                    fontSize={8.5}
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {r.sourceMultiplicity}
                  </SvgText>
                </G>
              )}

              {/* Multiplicidad Destino */}
              {r.targetMultiplicity && Number.isFinite(r.tgtMultX) && Number.isFinite(r.tgtMultY) && (
                <G>
                  <Rect
                    x={r.tgtMultX - 12}
                    y={r.tgtMultY - 8}
                    width={24}
                    height={15}
                    rx={4}
                    fill="rgba(15, 23, 42, 0.90)"
                    stroke="rgba(232, 195, 158, 0.30)"
                    strokeWidth={0.8}
                  />
                  <SvgText
                    x={r.tgtMultX}
                    y={r.tgtMultY + 3}
                    fill={isGhost ? colors.primary : '#ffffff'}
                    fontSize={8.5}
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {r.targetMultiplicity}
                  </SvgText>
                </G>
              )}

              {/* Pastilla central de Nombre / Rol si está presente */}
              {r.name && Number.isFinite(r.midX) && Number.isFinite(r.midY) ? (
                <G>
                  <Rect
                    x={r.midX - 35}
                    y={r.midY - 10}
                    width={70}
                    height={20}
                    rx={6}
                    fill="rgba(15, 23, 42, 0.94)"
                    stroke="rgba(232, 195, 158, 0.45)"
                    strokeWidth={1}
                  />
                  <SvgText
                    x={r.midX}
                    y={r.midY + 4}
                    fill={colors.primary}
                    fontSize={9}
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {r.name}
                  </SvgText>
                </G>
              ) : null}
            </G>
          </Svg>
        );
      })}
    </>
  );
});

CanvasRelationLayer.displayName = 'CanvasRelationLayer';

const styles = StyleSheet.create({
  relSvg: {
    position: 'absolute',
  },
});
