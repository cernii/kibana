/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import React from 'react';
import { Settings, TooltipType, Heatmap } from '@elastic/charts';
import { chartPluginMock } from '../../../../charts/public/mocks';
import { EmptyPlaceholder } from '../../../../charts/public';
import { fieldFormatsServiceMock } from '../../../../field_formats/public/mocks';
import type { Datatable } from '../../../../expressions/public';
import { mountWithIntl, shallowWithIntl } from '@kbn/test/jest';
import { findTestSubject } from '@elastic/eui/lib/test';
import { act } from 'react-dom/test-utils';
import { HeatmapRenderProps, HeatmapArguments } from '../../common';
import HeatmapComponent from './heatmap_component';

jest.mock('@elastic/charts', () => {
  const original = jest.requireActual('@elastic/charts');

  return {
    ...original,
    getSpecId: jest.fn(() => {}),
  };
});

const chartsThemeService = chartPluginMock.createSetupContract().theme;
const palettesRegistry = chartPluginMock.createPaletteRegistry();
const formatService = fieldFormatsServiceMock.createStartContract();
const args: HeatmapArguments = {
  percentageMode: false,
  legend: {
    isVisible: true,
    position: 'top',
    type: 'heatmap_legend',
  },
  gridConfig: {
    isCellLabelVisible: true,
    isYAxisLabelVisible: true,
    isXAxisLabelVisible: true,
    type: 'heatmap_grid',
  },
  palette: {
    type: 'palette',
    name: '',
    params: {
      colors: ['rgb(0, 0, 0)', 'rgb(112, 38, 231)'],
      stops: [0, 150],
      gradient: false,
      rangeMin: 0,
      rangeMax: 150,
      range: 'number',
    },
  },
  showTooltip: true,
  highlightInHover: false,
  xAccessor: 'col-1-2',
  valueAccessor: 'col-0-1',
};
const data: Datatable = {
  type: 'datatable',
  rows: [
    { 'col-0-1': 0, 'col-1-2': 'a' },
    { 'col-0-1': 148, 'col-1-2': 'b' },
  ],
  columns: [
    { id: 'col-0-1', name: 'Count', meta: { type: 'number' } },
    { id: 'col-1-2', name: 'Dest', meta: { type: 'string' } },
  ],
};

const mockState = new Map();
const uiState = {
  get: jest
    .fn()
    .mockImplementation((key, fallback) => (mockState.has(key) ? mockState.get(key) : fallback)),
  set: jest.fn().mockImplementation((key, value) => mockState.set(key, value)),
  emit: jest.fn(),
  setSilent: jest.fn(),
} as any;

describe('HeatmapComponent', function () {
  let wrapperProps: HeatmapRenderProps;

  beforeAll(() => {
    wrapperProps = {
      data,
      chartsThemeService,
      args,
      uiState,
      onClickValue: jest.fn(),
      onSelectRange: jest.fn(),
      paletteService: palettesRegistry,
      formatFactory: formatService.deserialize,
    };
  });

  it('renders the legend on the correct position', () => {
    const component = shallowWithIntl(<HeatmapComponent {...wrapperProps} />);
    expect(component.find(Settings).prop('legendPosition')).toEqual('top');
  });

  it('renders the legend toggle component if uiState is set', async () => {
    const component = mountWithIntl(<HeatmapComponent {...wrapperProps} />);
    await act(async () => {
      expect(findTestSubject(component, 'vislibToggleLegend').length).toBe(1);
    });
  });

  it('not renders the legend toggle component if uiState is undefined', async () => {
    const newProps = { ...wrapperProps, uiState: undefined } as unknown as HeatmapRenderProps;
    const component = mountWithIntl(<HeatmapComponent {...newProps} />);
    await act(async () => {
      expect(findTestSubject(component, 'vislibToggleLegend').length).toBe(0);
    });
  });

  it('renders the legendColorPicker if uiState is set', async () => {
    const component = mountWithIntl(<HeatmapComponent {...wrapperProps} />);
    await act(async () => {
      expect(component.find(Settings).prop('legendColorPicker')).toBeDefined();
    });
  });

  it('not renders the legendColorPicker if uiState is undefined', async () => {
    const newProps = { ...wrapperProps, uiState: undefined } as unknown as HeatmapRenderProps;
    const component = mountWithIntl(<HeatmapComponent {...newProps} />);
    await act(async () => {
      expect(component.find(Settings).prop('legendColorPicker')).toBeUndefined();
    });
  });

  it('computes the bands correctly for infinite bounds', async () => {
    const component = mountWithIntl(<HeatmapComponent {...wrapperProps} />);
    await act(async () => {
      expect(component.find(Heatmap).prop('colorScale')).toEqual({
        bands: [
          { color: 'rgb(0, 0, 0)', end: 0, start: 0 },
          { color: 'rgb(112, 38, 231)', end: Infinity, start: 0 },
        ],
        type: 'bands',
      });
    });
  });

  it('computes the bands correctly for distinct bounds', async () => {
    const newProps = {
      ...wrapperProps,
      args: { ...wrapperProps.args, lastRangeIsRightOpen: false },
    } as unknown as HeatmapRenderProps;
    const component = mountWithIntl(<HeatmapComponent {...newProps} />);
    await act(async () => {
      expect(component.find(Heatmap).prop('colorScale')).toEqual({
        bands: [
          { color: 'rgb(0, 0, 0)', end: 0, start: 0 },
          { color: 'rgb(112, 38, 231)', end: 150, start: 0 },
        ],
        type: 'bands',
      });
    });
  });

  it('hides the legend if the legend isVisible args is false', async () => {
    const newProps = {
      ...wrapperProps,
      args: { ...wrapperProps.args, legend: { ...wrapperProps.args.legend, isVisible: false } },
    } as unknown as HeatmapRenderProps;
    const component = mountWithIntl(<HeatmapComponent {...newProps} />);
    expect(component.find(Settings).prop('showLegend')).toEqual(false);
  });

  it('defaults on displaying the tooltip', () => {
    const component = shallowWithIntl(<HeatmapComponent {...wrapperProps} />);
    expect(component.find(Settings).prop('tooltip')).toStrictEqual({ type: TooltipType.Follow });
  });

  it('hides the legend if the showTooltip is false', async () => {
    const newProps = {
      ...wrapperProps,
      args: { ...wrapperProps.args, showTooltip: false },
    } as unknown as HeatmapRenderProps;
    const component = mountWithIntl(<HeatmapComponent {...newProps} />);
    expect(component.find(Settings).prop('tooltip')).toStrictEqual({ type: TooltipType.None });
  });

  it('not renders the component if no value accessor is given', () => {
    const newProps = { ...wrapperProps, valueAccessor: undefined } as unknown as HeatmapRenderProps;
    const component = mountWithIntl(<HeatmapComponent {...newProps} />);
    expect(component).toEqual({});
  });

  it('renders the EmptyPlaceholder if no data are provided', () => {
    const newData: Datatable = {
      type: 'datatable',
      rows: [],
      columns: [
        { id: 'col-0-1', name: 'Count', meta: { type: 'number' } },
        { id: 'col-1-2', name: 'Dest', meta: { type: 'string' } },
      ],
    };
    const newProps = { ...wrapperProps, data: newData };
    const component = mountWithIntl(<HeatmapComponent {...newProps} />);
    expect(component.find(EmptyPlaceholder).length).toBe(1);
  });

  it('calls filter callback', () => {
    const component = shallowWithIntl(<HeatmapComponent {...wrapperProps} />);
    component.find(Settings).first().prop('onElementClick')!([
      [
        {
          x: 436.68671874999995,
          y: 1,
          yIndex: 0,
          width: 143.22890625,
          height: 198.5,
          datum: {
            x: 'Vienna International Airport',
            y: 'ES-Air',
            value: 6,
            originalIndex: 12,
          },
          fill: {
            color: [78, 175, 98, 1],
          },
          stroke: {
            color: [128, 128, 128, 1],
            width: 0,
          },
          value: 6,
          visible: true,
          formatted: '6',
          fontSize: 18,
          textColor: 'rgba(0, 0, 0, 1)',
        },
        {
          specId: 'heatmap',
          key: 'spec{heatmap}',
        },
      ],
    ]);
    expect(wrapperProps.onClickValue).toHaveBeenCalled();
  });
});
