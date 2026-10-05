import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import LayoutBottomPanel from './LayoutBottomPanel';

const mockCameraLoad = jest.fn();
const mockCalculatorLoad = jest.fn();
jest.mock('../tools/QuickCameraCapture', () => {
  mockCameraLoad();
  const React = require('react');
  return { __esModule: true, default: function Camera({ active }: { active: boolean }) {
    const [count, setCount] = React.useState(0);
    return <button data-testid="camera" data-active={String(active)} onClick={() => setCount(count + 1)}>촬영 {count}</button>;
  } };
});
jest.mock('../tools/Calculator', () => {
  mockCalculatorLoad();
  return { __esModule: true, default: () => <div data-testid="calculator">계산기 내용</div> };
});

test('닫힌 패널에서는 도구를 불러오지 않고 선택한 도구만 처음 열 때 로드한다', async () => {
  const props = { togglePanel: jest.fn(), activeTool: 'calculator' as const };
  const { rerender } = render(<LayoutBottomPanel {...props} isOpen={false} />);
  expect(mockCameraLoad).not.toHaveBeenCalled();
  expect(mockCalculatorLoad).not.toHaveBeenCalled();
  rerender(<LayoutBottomPanel {...props} isOpen />);
  expect(await screen.findByTestId('calculator')).toBeVisible();
  expect(mockCalculatorLoad).toHaveBeenCalledTimes(1);
  expect(mockCameraLoad).not.toHaveBeenCalled();
});

test('카메라는 닫을 때 비활성화하고 다시 열 때 작업 상태를 보존한다', async () => {
  const props = { togglePanel: jest.fn(), activeTool: 'camera' as const };
  const { rerender } = render(<LayoutBottomPanel {...props} isOpen />);
  const camera = await screen.findByTestId('camera');
  fireEvent.click(camera);
  expect(camera).toHaveTextContent('촬영 1');
  rerender(<LayoutBottomPanel {...props} isOpen={false} />);
  expect(camera).toHaveAttribute('data-active', 'false');
  expect(camera).not.toBeVisible();
  rerender(<LayoutBottomPanel {...props} isOpen />);
  expect(screen.getByTestId('camera')).toBe(camera);
  expect(camera).toHaveAttribute('data-active', 'true');
  expect(camera).toHaveTextContent('촬영 1');
});
