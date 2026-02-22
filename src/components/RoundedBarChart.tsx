import { useMemo, useEffect, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import type { BarRow } from '../App';

interface RoundedBarChartProps {
  data: BarRow[];
  seriesNames: string[];
  colors: string[];
  title: string;
  cornerRadius: number;
  barHeight: number;
  chartPadding: number;
  showPadding: boolean;
  labelStyle: string;
  showLegend: boolean;
  legendPosition: string;
  showXAxis: boolean;
  showYAxis: boolean;
  fontFamily: string;
  fontSize: number;
  interactable: boolean;
  onBarClick: (category: string) => void;
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString();
}

export default function RoundedBarChart({
  data,
  seriesNames,
  colors,
  title,
  cornerRadius,
  barHeight,
  chartPadding,
  showPadding,
  labelStyle,
  showLegend,
  legendPosition,
  showXAxis,
  showYAxis,
  fontFamily,
  fontSize,
  interactable,
  onBarClick,
}: RoundedBarChartProps) {
  const chartRef = useRef<ReactECharts>(null);

  // ZRender raw click: fires for any click in the canvas (bar or empty row area).
  // Skipped entirely when interactable is off.
  useEffect(() => {
    if (!interactable) return;
    const instance = chartRef.current?.getEchartsInstance();
    if (!instance) return;
    const zr = instance.getZr();
    const handler = (e: { offsetX: number; offsetY: number }) => {
      // Ignore clicks outside the actual plot area (legend, title, padding)
      if (!instance.containPixel('grid', [e.offsetX, e.offsetY])) return;
      const pt = instance.convertFromPixel('grid', [e.offsetX, e.offsetY]);
      if (!pt) return;
      const yIdx = Math.round(pt[1]);
      if (yIdx >= 0 && yIdx < data.length) {
        onBarClick(data[yIdx].category);
      }
    };
    zr.on('click', handler);
    return () => zr.off('click', handler);
  }, [data, onBarClick, interactable]);

  const option = useMemo<EChartsOption>(() => {
    const effectivePadding = showPadding ? chartPadding : 0;
    const categories = data.map((d) => d.category);
    const n = seriesNames.length;
    const r = cornerRadius;
    const showLabel = labelStyle !== 'None';

    // Map fontFamily dropdown value → ECharts fontFamily string.
    // For Workbook Theme, read the document's computed font so ECharts can
    // measure text correctly (avoids cut-off when using a non-default font).
    const fontStyle = (() => {
      if (!fontFamily || fontFamily === 'Default') return {};
      if (fontFamily === 'Workbook Theme') {
        const detected =
          typeof window !== 'undefined'
            ? getComputedStyle(document.body).fontFamily
            : '';
        return detected ? { fontFamily: detected } : {};
      }
      return { fontFamily };
    })();

    // ECharts horizontal bar radius order: [top-left, top-right, bottom-right, bottom-left]
    function radiusFor(idx: number): number | number[] {
      if (n === 1) return r;
      if (idx === 0) return [r, 0, 0, r];
      if (idx === n - 1) return [0, r, r, 0];
      return 0;
    }

    const labelFormatter = (params: unknown) => {
      const p = params as { dataIndex: number };
      const row = data[p.dataIndex];
      if (labelStyle === 'First Value Only') return fmt(row.values[0]);
      return `${fmt(row.values[0])} / ${fmt(row.total)}`;
    };

    const series = seriesNames.map((name, idx) => ({
      name,
      type: 'bar' as const,
      stack: 'total',
      barWidth: barHeight,
      data: data.map((d) => d.values[idx] ?? 0),
      itemStyle: {
        color: colors[idx] ?? colors[colors.length - 1],
        borderRadius: radiusFor(idx),
      },
      silent: !interactable,
      emphasis: interactable ? { focus: 'series' as const } : { disabled: true },
      label:
        showLabel && idx === n - 1
          ? {
              show: true,
              position: 'right' as const,
              color: '#64748b',
              fontSize,
              ...fontStyle,
              formatter: labelFormatter,
            }
          : { show: false },
    }));

    // Legend placement based on legendPosition prop
    const isVerticalLegend =
      legendPosition === 'Left' ||
      legendPosition === 'Right' ||
      legendPosition === 'Top Right' ||
      legendPosition === 'Bottom Right';

    const legendPlacement = (() => {
      switch (legendPosition) {
        case 'Top':          return { top: effectivePadding / 2, left: 'center' as const };
        case 'Left':         return { left: effectivePadding / 2, top: 'middle' as const };
        case 'Right':        return { right: effectivePadding / 2, top: 'middle' as const };
        case 'Top Right':    return { top: effectivePadding / 2, right: effectivePadding / 2 };
        case 'Bottom Right': return { bottom: effectivePadding / 2, right: effectivePadding / 2 };
        default:             return { bottom: effectivePadding / 2, left: 'center' as const };
      }
    })();

    const legendConfig = showLegend
      ? {
          orient: isVerticalLegend ? ('vertical' as const) : ('horizontal' as const),
          ...legendPlacement,
          data: seriesNames,
          itemStyle: { borderWidth: 0 },
          textStyle: { ...fontStyle, color: '#64748b', fontSize },
        }
      : { show: false };

    // Grid offsets
    const legendOffset = showLegend ? 32 : 0;
    const legendOnRight =
      legendPosition === 'Right' ||
      legendPosition === 'Top Right' ||
      legendPosition === 'Bottom Right';

    // Dynamic right-legend width: 20px swatch + 8px gap + ~7px per character
    const legendRightWidth = showLegend && legendOnRight
      ? 28 + Math.max(...seriesNames.map((sn) => sn.length), 0) * 7
      : 0;

    // When padding is off and an axis is hidden, collapse that side to 0 so
    // ECharts doesn't reserve phantom space for the hidden axis.
    const legendAtBottom = showLegend && legendPosition === 'Bottom';
    const legendAtTop    = showLegend && legendPosition === 'Top';
    const legendAtLeft   = showLegend && legendPosition === 'Left';

    const gridTop = !showPadding && !title && !legendAtTop
      ? 0
      : (title ? effectivePadding + 32 : effectivePadding) + (legendAtTop ? legendOffset : 0);

    const gridBottom = !showPadding && !showXAxis && !legendAtBottom
      ? 0
      : effectivePadding + (legendAtBottom ? legendOffset : 0);

    const gridLeft = !showPadding && !showYAxis && !legendAtLeft
      ? 0
      : effectivePadding + (legendAtLeft ? 80 : 0);

    // When legend is on the right, it shares space with value labels — use whichever is larger
    const gridRight = legendOnRight && showLegend
      ? Math.max(legendRightWidth, showLabel ? 80 : 0) + effectivePadding
      : (showLabel ? effectivePadding + 80 : effectivePadding);

    // containLabel adds internal padding for label text — skip it when all
    // axis labels are hidden to avoid phantom whitespace.
    const containLabel = showYAxis || showXAxis;

    return {
      title: title
        ? {
            text: title,
            left: 'left',
            top: effectivePadding / 2,
            textStyle: { ...fontStyle, fontSize: fontSize + 3, fontWeight: 600, color: '#1e293b' },
          }
        : undefined,
      tooltip: interactable
        ? {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            formatter: (params: unknown) => {
              const p = params as Array<{ seriesName: string; value: number; dataIndex: number }>;
              if (p.length === 0) return '';
              const idx = p[0].dataIndex;
              const row = data[idx];
              const lines = [`<b>${row.category}</b>`];
              seriesNames.forEach((name, si) => {
                lines.push(`${name}: ${fmt(row.values[si] ?? 0)}`);
              });
              lines.push(`Total: ${fmt(row.total)}`);
              return lines.join('<br/>');
            },
          }
        : { show: false },
      legend: legendConfig,
      grid: {
        top: gridTop,
        bottom: gridBottom,
        left: gridLeft,
        right: gridRight,
        containLabel,
      },
      xAxis: {
        type: 'value',
        show: showXAxis,
        splitLine: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { ...fontStyle, color: '#94a3b8', fontSize: fontSize - 1 },
      },
      yAxis: {
        type: 'category',
        data: categories,
        inverse: false,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          ...fontStyle,
          show: showYAxis,
          color: '#475569',
          fontSize,
        },
      },
      series,
    };
  }, [data, seriesNames, colors, title, cornerRadius, barHeight, chartPadding, showPadding, labelStyle, showLegend, legendPosition, showXAxis, showYAxis, fontFamily, fontSize, interactable]);

  return (
    <ReactECharts
      ref={chartRef}
      option={option}
      style={{ width: '100%', height: '100%' }}
      opts={{ renderer: 'svg' }}
      notMerge
    />
  );
}
