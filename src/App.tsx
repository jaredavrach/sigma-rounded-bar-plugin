import { useCallback } from 'react';
import {
  client,
  useConfig,
  useElementData,
  useElementColumns,
  useActionTrigger,
} from '@sigmacomputing/plugin';
import RoundedBarChart from './components/RoundedBarChart';
import './App.css';

client.config.configureEditorPanel([
  // ── Data ──────────────────────────────────────────────────────────────────
  { name: 'source', type: 'element', label: 'Data Source' },
  {
    name: 'categoryColumn',
    type: 'column',
    source: 'source',
    allowMultiple: false,
    label: 'Category (Y Axis)',
  },
  {
    name: 'valueColumns',
    type: 'column',
    source: 'source',
    allowMultiple: true,
    label: 'Value Columns (stacked series)',
  },

  // ── Appearance ────────────────────────────────────────────────────────────
  { name: 'title', type: 'text', label: 'Chart Title', defaultValue: '', placeholder: 'Enter chart title' },
  {
    name: 'cornerRadius',
    type: 'dropdown',
    label: 'Corner Radius (px)',
    values: ['0', '4', '8', '12', '16', '20', '24'],
    defaultValue: '8',
  },
  {
    name: 'barHeight',
    type: 'dropdown',
    label: 'Bar Height (px)',
    values: ['12', '16', '20', '24', '28', '32'],
    defaultValue: '20',
  },
  {
    name: 'chartPadding',
    type: 'dropdown',
    label: 'Chart Padding (px)',
    values: ['0', '8', '16', '24'],
    defaultValue: '16',
  },
  {
    name: 'labelStyle',
    type: 'dropdown',
    label: 'Value Label Style',
    values: ['None', 'First Value / Total', 'First Value Only'],
    defaultValue: 'None',
  },
  { name: 'showTitle', type: 'toggle', label: 'Show Title', defaultValue: true },
  { name: 'showLegend', type: 'toggle', label: 'Show Legend', defaultValue: true },
  {
    name: 'legendPosition',
    type: 'dropdown',
    label: 'Legend Position',
    values: ['Bottom', 'Top', 'Left', 'Right', 'Top Right', 'Bottom Right'],
    defaultValue: 'Bottom',
  },
  { name: 'showXAxis', type: 'toggle', label: 'Show X Axis Label', defaultValue: true },
  { name: 'showYAxis', type: 'toggle', label: 'Show Y Axis Labels', defaultValue: true },
  { name: 'showPadding', type: 'toggle', label: 'Show Padding', defaultValue: true },
  {
    name: 'fontFamily',
    type: 'dropdown',
    label: 'Font Family',
    values: [
      'Default', 'Workbook Theme',
      'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat',
      'Poppins', 'DM Sans', 'Nunito', 'Source Serif Pro', 'Arial', 'Georgia',
    ],
    defaultValue: 'Default',
  },
  {
    name: 'fontSize',
    type: 'dropdown',
    label: 'Font Size',
    values: ['10', '11', '12', '13', '14', '16', '18', '20'],
    defaultValue: '12',
  },
  { name: 'interactable', type: 'toggle', label: 'Interactable', defaultValue: true },

  // ── Target Line ────────────────────────────────────────────────────────────
  { name: 'showTargetLine', type: 'toggle', label: 'Show Target Line', defaultValue: false },
  {
    name: 'targetLineColumn',
    type: 'column',
    source: 'source',
    allowMultiple: false,
    label: 'Target Line Value (column or formula column)',
  },
  { name: 'targetLineColor', type: 'color', label: 'Target Line Color' },
  {
    name: 'targetLineThickness',
    type: 'dropdown',
    label: 'Target Line Thickness (px)',
    values: ['1', '2', '3', '4', '5'],
    defaultValue: '2',
  },

  // ── Colors ────────────────────────────────────────────────────────────────
  { name: 'color1', type: 'color', label: 'Series 1 Color' },
  { name: 'color2', type: 'color', label: 'Series 2 Color' },
  { name: 'color3', type: 'color', label: 'Series 3 Color' },

  // ── Interactions ──────────────────────────────────────────────────────────
  {
    name: 'clickVariable',
    type: 'variable',
    allowedTypes: ['text'],
    label: 'On Click: Set Variable (optional)',
  },
  { name: 'onClickAction', type: 'action-trigger', label: 'On Bar Click' },
]);

export interface BarRow {
  category: string;
  values: number[];
  total: number;
}

const DEFAULT_COLORS = ['#2563EB', '#93C5FD', '#E2E8F0', '#60A5FA', '#BFDBFE', '#DBEAFE'];

function App() {
  const config = useConfig();
  const sigmaData = useElementData(config.source);
  const columnInfo = useElementColumns(config.source);
  const triggerOnClick = useActionTrigger(config.onClickAction);

  const title = (config.title as string | undefined) ?? '';
  const cornerRadius = parseInt((config.cornerRadius as string | undefined) ?? '8', 10);
  const barHeight = parseInt((config.barHeight as string | undefined) ?? '20', 10);
  const chartPadding = parseInt((config.chartPadding as string | undefined) ?? '16', 10);
  const labelStyle = (config.labelStyle as string | undefined) ?? 'None';
  const showTitle = (config.showTitle as boolean | undefined) ?? true;
  const showLegend = (config.showLegend as boolean | undefined) ?? true;
  const legendPosition = (config.legendPosition as string | undefined) ?? 'Bottom';
  const showXAxis = (config.showXAxis as boolean | undefined) ?? true;
  const showYAxis = (config.showYAxis as boolean | undefined) ?? true;
  const showPadding = (config.showPadding as boolean | undefined) ?? true;
  const fontFamily = (config.fontFamily as string | undefined) ?? 'Default';
  const fontSize = parseInt((config.fontSize as string | undefined) ?? '12', 10);
  const interactable = (config.interactable as boolean | undefined) ?? true;
  const showTargetLine = (config.showTargetLine as boolean | undefined) ?? false;
  const targetLineColId = config.targetLineColumn as string | undefined;
  // Read the first numeric value from the selected column as the target position
  const targetLineValue = (() => {
    if (!targetLineColId || !sigmaData) return NaN;
    const col = sigmaData[targetLineColId];
    if (!Array.isArray(col) || col.length === 0) return NaN;
    const v = Number(col[0]);
    return isNaN(v) ? NaN : v;
  })();
  const targetLineColor = (config.targetLineColor as string | undefined) ?? '#000000';
  const targetLineThickness = parseInt((config.targetLineThickness as string | undefined) ?? '2', 10);

  const userColors = [
    (config.color1 as string | undefined) ?? DEFAULT_COLORS[0],
    (config.color2 as string | undefined) ?? DEFAULT_COLORS[1],
    (config.color3 as string | undefined) ?? DEFAULT_COLORS[2],
    ...DEFAULT_COLORS.slice(3),
  ];

  const onBarClick = useCallback(
    (category: string) => {
      if (config.clickVariable) {
        client.config.setVariable(config.clickVariable as string, category);
      }
      if (config.onClickAction) {
        setTimeout(() => triggerOnClick(), 100);
      }
    },
    [config.clickVariable, config.onClickAction, triggerOnClick],
  );

  // ── Data transform ────────────────────────────────────────────────────────
  const catId = config.categoryColumn as string | undefined;
  const valueIds = (config.valueColumns as string[] | string | undefined);
  const valueIdArray: string[] = Array.isArray(valueIds)
    ? valueIds
    : valueIds
    ? [valueIds]
    : [];

  const seriesNames: string[] = valueIdArray.map(
    (id) => (columnInfo?.[id]?.name as string | undefined) ?? id,
  );

  const chartData: BarRow[] = (() => {
    if (!sigmaData || !columnInfo || !catId || valueIdArray.length === 0) return [];
    const categories = sigmaData[catId] as unknown[] | undefined;
    if (!categories || !Array.isArray(categories)) return [];

    const aggregated = new Map<string, BarRow>();
    categories.forEach((cat, i) => {
      const category = String(cat ?? '');
      if (aggregated.has(category)) return;
      const values = valueIdArray.map((id) => Number(sigmaData[id]?.[i] ?? 0));
      const total = values.reduce((s, v) => s + v, 0);
      aggregated.set(category, { category, values, total });
    });
    return Array.from(aggregated.values());
  })();

  if (chartData.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#94a3b8',
          fontSize: 14,
        }}
      >
        Configure the data source and columns in the editor panel.
      </div>
    );
  }

  return (
    <RoundedBarChart
      data={chartData}
      seriesNames={seriesNames}
      colors={userColors}
      title={showTitle ? title : ''}
      cornerRadius={cornerRadius}
      barHeight={barHeight}
      chartPadding={chartPadding}
      labelStyle={labelStyle}
      showLegend={showLegend}
      legendPosition={legendPosition}
      showXAxis={showXAxis}
      showYAxis={showYAxis}
      showPadding={showPadding}
      fontFamily={fontFamily}
      fontSize={fontSize}
      interactable={interactable}
      showTargetLine={showTargetLine}
      targetLineValue={targetLineValue}
      targetLineColor={targetLineColor}
      targetLineThickness={targetLineThickness}
      onBarClick={onBarClick}
    />
  );
}

export default App;
