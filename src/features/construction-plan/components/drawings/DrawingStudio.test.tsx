import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DrawingStudio } from './DrawingStudio';
import { DrawingStudioValue } from './types';

const mockCanvasBounds = (canvas: SVGSVGElement) => {
  jest.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
    left: 100,
    top: 50,
    width: 1000,
    height: 700,
    right: 1100,
    bottom: 750,
    x: 100,
    y: 50,
    toJSON: () => undefined,
  });
};

describe('DrawingStudio', () => {
  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;

  beforeAll(() => {
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: jest.fn(() => 'blob:preview') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: jest.fn() });
  });

  afterAll(() => {
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateObjectUrl });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: originalRevokeObjectUrl });
  });

  it('draws a rectangle with normalized coordinates and emits it', () => {
    const onChange = jest.fn();
    render(<DrawingStudio onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /^사각형$/ }));
    const canvas = screen.getByRole('img', { name: '시공 도면 표시 캔버스' }) as unknown as SVGSVGElement;
    mockCanvasBounds(canvas);

    fireEvent(canvas, new MouseEvent('pointerdown', { bubbles: true, clientX: 200, clientY: 120 }));
    fireEvent(canvas, new MouseEvent('pointermove', { bubbles: true, clientX: 600, clientY: 400 }));
    fireEvent(canvas, new MouseEvent('pointerup', { bubbles: true, clientX: 600, clientY: 400 }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as DrawingStudioValue;
    expect(next.objects).toHaveLength(1);
    expect(next.objects[0]).toMatchObject({ kind: 'rectangle', layer: 'install' });
    expect(next.objects[0].points).toEqual([{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.5 }]);
    expect(screen.getByText('등록된 표시 1')).toBeTruthy();
  });

  it('updates the selected object label and can undo the update', () => {
    const defaultValue: DrawingStudioValue = {
      schemaVersion: 1,
      objects: [{
        id: 'zone-one',
        kind: 'rectangle',
        layer: 'install',
        points: [{ x: 0.1, y: 0.1 }, { x: 0.4, y: 0.4 }],
        label: '',
        zoneCode: '',
      }],
    };
    const onChange = jest.fn();
    render(<DrawingStudio defaultValue={defaultValue} onChange={onChange} />);

    const canvasObject = document.querySelector('[data-object-id="zone-one"]');
    expect(canvasObject).toBeTruthy();
    fireEvent.pointerDown(canvasObject as Element);
    const input = screen.getByLabelText('구역 코드');
    fireEvent.change(input, { target: { value: 'A-01' } });

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      objects: [expect.objectContaining({ zoneCode: 'A-01' })],
    }));
    fireEvent.click(screen.getByRole('button', { name: '마지막 변경 실행 취소' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      objects: [expect.objectContaining({ zoneCode: '' })],
    }));
  });

  it('locks the layer standard style and edits structured layer attributes', () => {
    const onChange = jest.fn();
    render(<DrawingStudio
      defaultValue={{
        schemaVersion: 1,
        objects: [{
          id: 'styled-zone',
          kind: 'rectangle',
          layer: 'install',
          points: [{ x: 0.1, y: 0.1 }, { x: 0.4, y: 0.4 }],
          label: '설치구간',
          zoneCode: 'A-01',
          sequence: 1,
        }, {
          id: 'styled-text',
          kind: 'text',
          layer: 'restricted',
          points: [{ x: 0.5, y: 0.2 }, { x: 0.8, y: 0.3 }],
          label: '출입통제',
          zoneCode: 'R-01',
          startDate: '08:00',
          endDate: '18:00',
          responsibleWorkerId: 'worker-1',
          responsibleRole: '통제담당',
        }],
      }}
      onChange={onChange}
    />);

    fireEvent.pointerDown(document.querySelector('[data-object-id="styled-zone"]') as Element);
    expect(screen.getByLabelText('레이어 표준 스타일').textContent).toContain('표준 스타일 고정');
    expect(screen.queryByLabelText('선 색상')).toBeNull();
    fireEvent.change(screen.getByLabelText('작업 순서'), { target: { value: '3' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      objects: expect.arrayContaining([expect.objectContaining({
        id: 'styled-zone',
        sequence: 3,
      })]),
    }));

    fireEvent.pointerDown(document.querySelector('[data-object-id="styled-text"]') as Element);
    fireEvent.change(screen.getByLabelText('담당 역할'), { target: { value: '안전통제담당' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      objects: expect.arrayContaining([expect.objectContaining({
        id: 'styled-text',
        responsibleRole: '안전통제담당',
      })]),
    }));
  });

  it('creates a point marker with one normalized coordinate', () => {
    const onChange = jest.fn();
    render(<DrawingStudio onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /마커/ }));
    const canvas = screen.getByRole('img', { name: '시공 도면 표시 캔버스' }) as unknown as SVGSVGElement;
    mockCanvasBounds(canvas);
    fireEvent(canvas, new MouseEvent('pointerdown', { bubbles: true, clientX: 350, clientY: 260 }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toMatchObject({
      objects: [{ kind: 'marker', points: [{ x: 0.25, y: 0.3 }] }],
    });
  });

  it('duplicates, undoes, redoes and locks a selected object without losing its geometry', () => {
    const onChange = jest.fn();
    render(<DrawingStudio
      defaultValue={{
        schemaVersion: 1,
        objects: [{
          id: 'ellipse-one',
          kind: 'ellipse',
          layer: 'restricted',
          points: [{ x: 0.1, y: 0.1 }, { x: 0.4, y: 0.5 }],
          label: '위험 반경',
          zoneCode: 'R-01',
        }],
      }}
      onChange={onChange}
    />);

    fireEvent.pointerDown(document.querySelector('[data-object-id="ellipse-one"]') as Element);
    fireEvent.click(screen.getAllByRole('button', { name: '선택한 표시 복제' })[0]);
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      objects: expect.arrayContaining([
        expect.objectContaining({ kind: 'ellipse', label: '위험 반경' }),
        expect.objectContaining({ kind: 'ellipse', label: '위험 반경 복사' }),
      ]),
    }));

    fireEvent.click(screen.getByRole('button', { name: '마지막 변경 실행 취소' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ objects: [expect.any(Object)] }));
    fireEvent.click(screen.getByRole('button', { name: '취소한 변경 다시 실행' }));
    expect((onChange.mock.calls.at(-1)?.[0] as DrawingStudioValue).objects).toHaveLength(2);

    fireEvent.pointerDown(document.querySelector('[data-object-id^="mark-"]') as Element);
    fireEvent.click(screen.getByRole('button', { name: '잠금' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      objects: expect.arrayContaining([expect.objectContaining({ locked: true })]),
    }));
    const callCount = onChange.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: '선택한 표시 삭제' }));
    expect(onChange).toHaveBeenCalledTimes(callCount);
  });

  it('drags polygon, polyline and marker geometry as complete normalized objects', () => {
    const onChange = jest.fn();
    render(<DrawingStudio
      defaultValue={{
        schemaVersion: 1,
        objects: [{
          id: 'polygon-move',
          kind: 'polygon',
          layer: 'install',
          points: [{ x: 0.1, y: 0.1 }, { x: 0.3, y: 0.1 }, { x: 0.2, y: 0.3 }],
          label: '',
          zoneCode: '',
        }, {
          id: 'polyline-move',
          kind: 'polyline',
          layer: 'pedestrian',
          points: [{ x: 0.2, y: 0.6 }, { x: 0.4, y: 0.7 }, { x: 0.6, y: 0.6 }],
          label: '',
          zoneCode: '',
          rotationDeg: 12,
          arrowStart: true,
          arrowEnd: false,
          style: {
            strokeToken: 'green',
            strokeWidthPt: 3,
            opacity: 0.8,
            dash: 'dot',
          },
        }, {
          id: 'marker-move',
          kind: 'marker',
          layer: 'equipment',
          points: [{ x: 0.8, y: 0.8 }],
          label: '',
          zoneCode: '',
          markerType: 'crane',
        }],
      }}
      onChange={onChange}
    />);
    const canvas = screen.getByRole('img', { name: '시공 도면 표시 캔버스' }) as unknown as SVGSVGElement;
    mockCanvasBounds(canvas);

    fireEvent(document.querySelector('[data-object-id="polygon-move"]') as Element,
      new MouseEvent('pointerdown', { bubbles: true, clientX: 200, clientY: 120 }));
    fireEvent(canvas, new MouseEvent('pointermove', { bubbles: true, clientX: 300, clientY: 190 }));
    fireEvent(canvas, new MouseEvent('pointerup', { bubbles: true, clientX: 300, clientY: 190 }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      objects: expect.arrayContaining([expect.objectContaining({
        id: 'polygon-move',
        points: [{ x: 0.2, y: 0.2 }, { x: 0.4, y: 0.2 }, { x: 0.3, y: 0.4 }],
      })]),
    }));

    fireEvent(document.querySelector('[data-object-id="polyline-move"]') as Element,
      new MouseEvent('pointerdown', { bubbles: true, clientX: 300, clientY: 470 }));
    fireEvent(canvas, new MouseEvent('pointermove', { bubbles: true, clientX: 400, clientY: 400 }));
    fireEvent(canvas, new MouseEvent('pointerup', { bubbles: true, clientX: 400, clientY: 400 }));
    expect((onChange.mock.calls.at(-1)?.[0] as DrawingStudioValue).objects.find((item) => item.id === 'polyline-move')?.points)
      .toEqual([{ x: 0.3, y: 0.5 }, { x: 0.5, y: 0.6 }, { x: 0.7, y: 0.5 }]);
    expect((onChange.mock.calls.at(-1)?.[0] as DrawingStudioValue).objects.find((item) => item.id === 'polyline-move'))
      .toMatchObject({
        rotationDeg: 12,
        arrowStart: true,
        arrowEnd: false,
        style: { strokeToken: 'green', strokeWidthPt: 3, opacity: 0.8, dash: 'dot' },
      });

    fireEvent(document.querySelector('[data-object-id="marker-move"]') as Element,
      new MouseEvent('pointerdown', { bubbles: true, clientX: 900, clientY: 610 }));
    fireEvent(canvas, new MouseEvent('pointermove', { bubbles: true, clientX: 800, clientY: 540 }));
    fireEvent(canvas, new MouseEvent('pointerup', { bubbles: true, clientX: 800, clientY: 540 }));
    expect((onChange.mock.calls.at(-1)?.[0] as DrawingStudioValue).objects.find((item) => item.id === 'marker-move')?.points)
      .toEqual([{ x: 0.7, y: 0.7 }]);
    expect((onChange.mock.calls.at(-1)?.[0] as DrawingStudioValue).objects.find((item) => item.id === 'marker-move')?.markerType)
      .toBe('crane');
  });

  it('resizes a box with handles and round-trips the single autosave mutation through undo and redo', () => {
    const onChange = jest.fn();
    render(<DrawingStudio
      defaultValue={{
        schemaVersion: 1,
        objects: [{
          id: 'resize-one',
          kind: 'rectangle',
          layer: 'install',
          points: [{ x: 0.1, y: 0.1 }, { x: 0.4, y: 0.4 }],
          label: '설치 구간',
          zoneCode: 'A-01',
        }],
      }}
      onChange={onChange}
    />);
    const canvas = screen.getByRole('img', { name: '시공 도면 표시 캔버스' }) as unknown as SVGSVGElement;
    mockCanvasBounds(canvas);
    const shape = document.querySelector('[data-object-id="resize-one"]') as Element;
    fireEvent(shape, new MouseEvent('pointerdown', { bubbles: true, clientX: 200, clientY: 120 }));
    fireEvent(canvas, new MouseEvent('pointerup', { bubbles: true, clientX: 200, clientY: 120 }));

    const handle = screen.getByRole('button', { name: '선택한 표시 오른쪽 아래 크기 조절' });
    fireEvent(handle, new MouseEvent('pointerdown', { bubbles: true, clientX: 500, clientY: 330 }));
    fireEvent(canvas, new MouseEvent('pointermove', { bubbles: true, clientX: 700, clientY: 470 }));
    fireEvent(canvas, new MouseEvent('pointerup', { bubbles: true, clientX: 700, clientY: 470 }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect((onChange.mock.calls[0][0] as DrawingStudioValue).objects[0].points)
      .toEqual([{ x: 0.1, y: 0.1 }, { x: 0.6, y: 0.6 }]);
    fireEvent.click(screen.getByRole('button', { name: '마지막 변경 실행 취소' }));
    expect((onChange.mock.calls.at(-1)?.[0] as DrawingStudioValue).objects[0].points)
      .toEqual([{ x: 0.1, y: 0.1 }, { x: 0.4, y: 0.4 }]);
    fireEvent.click(screen.getByRole('button', { name: '취소한 변경 다시 실행' }));
    expect((onChange.mock.calls.at(-1)?.[0] as DrawingStudioValue).objects[0].points)
      .toEqual([{ x: 0.1, y: 0.1 }, { x: 0.6, y: 0.6 }]);
  });

  it('zooms, resets and pans with both the hand tool and Space-drag', () => {
    render(<DrawingStudio />);
    const canvas = screen.getByRole('img', { name: '시공 도면 표시 캔버스' }) as unknown as SVGSVGElement;
    mockCanvasBounds(canvas);
    expect(canvas.getAttribute('viewBox')).toBe('0 0 1000 700');

    fireEvent.click(screen.getByRole('button', { name: '도면 확대' }));
    expect(screen.getByLabelText('도면 확대 비율').textContent).toBe('125%');
    expect(canvas.getAttribute('viewBox')).toBe('100 70 800 560');

    fireEvent.click(screen.getByRole('button', { name: '도면 이동 모드' }));
    fireEvent(canvas, new MouseEvent('pointerdown', { bubbles: true, clientX: 600, clientY: 400 }));
    fireEvent(canvas, new MouseEvent('pointermove', { bubbles: true, clientX: 700, clientY: 400 }));
    fireEvent(canvas, new MouseEvent('pointerup', { bubbles: true, clientX: 700, clientY: 400 }));
    expect(canvas.getAttribute('viewBox')).toBe('20 70 800 560');

    fireEvent.click(screen.getByRole('button', { name: '도면 이동 모드' }));
    fireEvent.keyDown(canvas, { key: ' ' });
    fireEvent(canvas, new MouseEvent('pointerdown', { bubbles: true, clientX: 600, clientY: 400 }));
    fireEvent(canvas, new MouseEvent('pointermove', { bubbles: true, clientX: 500, clientY: 400 }));
    fireEvent(canvas, new MouseEvent('pointerup', { bubbles: true, clientX: 500, clientY: 400 }));
    fireEvent.keyUp(canvas, { key: ' ' });
    expect(canvas.getAttribute('viewBox')).toBe('100 70 800 560');

    fireEvent.click(screen.getByRole('button', { name: '도면 축소' }));
    expect(canvas.getAttribute('viewBox')).toBe('0 0 1000 700');
    fireEvent.click(screen.getByRole('button', { name: '도면 확대' }));
    fireEvent.click(screen.getByRole('button', { name: '도면 확대 및 위치 초기화' }));
    expect(canvas.getAttribute('viewBox')).toBe('0 0 1000 700');
  });

  it('keeps locked geometry immutable and constrains Shift-drag creation', () => {
    const onChange = jest.fn();
    render(<DrawingStudio
      defaultValue={{
        schemaVersion: 1,
        objects: [{
          id: 'locked-zone',
          kind: 'rectangle',
          layer: 'restricted',
          points: [{ x: 0.7, y: 0.7 }, { x: 0.9, y: 0.9 }],
          label: '',
          zoneCode: '',
          locked: true,
        }],
      }}
      onChange={onChange}
    />);
    const canvas = screen.getByRole('img', { name: '시공 도면 표시 캔버스' }) as unknown as SVGSVGElement;
    mockCanvasBounds(canvas);
    fireEvent(document.querySelector('[data-object-id="locked-zone"]') as Element,
      new MouseEvent('pointerdown', { bubbles: true, clientX: 800, clientY: 540 }));
    fireEvent(canvas, new MouseEvent('pointermove', { bubbles: true, clientX: 400, clientY: 260 }));
    fireEvent(canvas, new MouseEvent('pointerup', { bubbles: true, clientX: 400, clientY: 260 }));
    fireEvent.keyDown(canvas, { key: 'ArrowLeft' });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /크기 조절/ })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /^사각형$/ }));
    fireEvent(canvas, new MouseEvent('pointerdown', { bubbles: true, clientX: 200, clientY: 120 }));
    fireEvent(canvas, new MouseEvent('pointermove', { bubbles: true, clientX: 500, clientY: 190, shiftKey: true }));
    fireEvent(canvas, new MouseEvent('pointerup', { bubbles: true, clientX: 500, clientY: 190, shiftKey: true }));
    const created = (onChange.mock.calls.at(-1)?.[0] as DrawingStudioValue).objects.at(-1);
    expect(created?.points).toEqual([{ x: 0.1, y: 0.1 }, { x: 0.4, y: 0.528571 }]);
  });

  it('registers PDF metadata and explains automatic preview processing', async () => {
    const onChange = jest.fn();
    const onBackgroundFileChange = jest.fn();
    render(<DrawingStudio onChange={onChange} onBackgroundFileChange={onBackgroundFileChange} />);

    const file = new File(['pdf'], '구조도면.pdf', { type: 'application/pdf' });
    await userEvent.upload(screen.getByLabelText('도면 파일 선택'), file);

    expect(onBackgroundFileChange).toHaveBeenCalledWith(file, expect.objectContaining({
      fileName: '구조도면.pdf',
      kind: 'pdf',
      mimeType: 'application/pdf',
    }));
    expect(screen.getByText('PDF 미리보기 준비 중')).toBeTruthy();
    expect(screen.getByText(/서버에서 페이지 미리보기를 자동 생성/)).toBeTruthy();
    expect(screen.getByText(/준비 전에는 검토 요청이 차단됩니다/)).toBeTruthy();
  });

  it('temporarily hides and restores a complete layer without mutating saved annotations', () => {
    const onChange = jest.fn();
    render(<DrawingStudio
      defaultValue={{
        schemaVersion: 1,
        objects: [{
          id: 'install-one',
          kind: 'rectangle',
          layer: 'install',
          points: [{ x: 0.1, y: 0.1 }, { x: 0.4, y: 0.4 }],
          label: '설치구간',
          zoneCode: 'A-01',
        }],
      }}
      onChange={onChange}
    />);

    expect(document.querySelector('[data-object-id="install-one"]')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '설치 구간 레이어 숨기기' }));
    expect(document.querySelector('[data-object-id="install-one"]')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '설치 구간 레이어 표시' }));
    expect(document.querySelector('[data-object-id="install-one"]')).toBeTruthy();
  });

  it('selects an exact page from a ready server preview manifest', () => {
    const onPreviewPageChange = jest.fn();
    render(<DrawingStudio
      defaultValue={{
        schemaVersion: 1,
        background: {
          fileName: 'source.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1000,
          kind: 'pdf',
          storagePath: 'construction-plans/site-1/plan-1/drawings/source.pdf',
        },
        preview: {
          status: 'ready',
          pageIndex: 0,
          pageCount: 2,
          availablePageIndexes: [0, 1],
          pageFingerprint: `source:${'a'.repeat(64)}:page:0`,
          storagePath: 'construction-plans/site-1/plan-1/previews/drawing-1/page-0001.png',
          sourceUrl: 'blob:preview',
        },
        objects: [],
      }}
      onPreviewPageChange={onPreviewPageChange}
    />);

    fireEvent.change(screen.getByLabelText('미리보기 페이지'), { target: { value: '1' } });
    expect(onPreviewPageChange).toHaveBeenCalledWith(1);
    expect(screen.getByText(/1\/2페이지/)).toBeTruthy();
  });

  it('lazily hydrates real PDF page thumbnails and selects the exact page', async () => {
    const onPreviewPageChange = jest.fn();
    const resolvePreviewPageUrl = jest.fn(async (pageIndex: number) => `blob:thumbnail-${pageIndex}`);
    render(<DrawingStudio
      defaultValue={{
        schemaVersion: 1,
        background: {
          fileName: 'source.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1000,
          kind: 'pdf',
          storagePath: 'construction-plans/site-1/plan-1/drawings/source.pdf',
        },
        preview: {
          status: 'ready',
          pageIndex: 0,
          pageCount: 2,
          availablePageIndexes: [0, 1],
          pageFingerprint: `source:${'a'.repeat(64)}:page:0`,
          storagePath: 'construction-plans/site-1/plan-1/previews/drawing-1/page-0001.png',
          sourceUrl: 'blob:selected-page',
        },
        objects: [],
      }}
      onPreviewPageChange={onPreviewPageChange}
      resolvePreviewPageUrl={resolvePreviewPageUrl}
    />);

    expect(screen.getByRole('navigation', { name: 'PDF 페이지 썸네일' })).toBeTruthy();
    expect(screen.getByAltText('1페이지 썸네일').getAttribute('src')).toBe('blob:selected-page');
    await waitFor(() => expect(resolvePreviewPageUrl).toHaveBeenCalledWith(1));
    expect((await screen.findByAltText('2페이지 썸네일')).getAttribute('src')).toBe('blob:thumbnail-1');
    fireEvent.click(screen.getByRole('button', { name: '2페이지 미리보기 선택' }));
    expect(onPreviewPageChange).toHaveBeenCalledWith(1);
  });

  it('intercepts DWG files and shows the concrete PDF conversion guide', async () => {
    const onBackgroundFileChange = jest.fn();
    render(<DrawingStudio onBackgroundFileChange={onBackgroundFileChange} />);

    const file = new File(['dwg'], '구조도면.dwg', { type: 'application/acad' });
    await userEvent.upload(screen.getByLabelText('도면 파일 선택'), file);

    expect(screen.getByRole('alert').textContent).toContain('DWG는 승인도면 PDF로 변환해 등록하세요');
    expect(screen.getByRole('alert').textContent).toContain('암호를 설정하지 말고 50MB 이하');
    expect(onBackgroundFileChange).not.toHaveBeenCalled();
  });

  it('keeps the first-use polygon exercise separate from plan annotations', () => {
    const storageKey = 'construction-plan:drawing-polygon-practice:test-user:v1';
    window.localStorage.removeItem(storageKey);
    const onChange = jest.fn();
    render(<DrawingStudio
      showFirstUsePractice
      firstUsePracticeStorageKey={storageKey}
      onChange={onChange}
    />);

    expect(screen.getByRole('dialog', { name: '다각형으로 작업구간을 표시해 보세요' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '점 1 추가' }));
    fireEvent.click(screen.getByRole('button', { name: '점 2 추가' }));
    fireEvent.click(screen.getByRole('button', { name: '점 3 추가' }));
    fireEvent.click(screen.getByRole('button', { name: '연습 완료' }));

    expect(screen.getByRole('img', { name: '시공 도면 표시 캔버스' })).toBeTruthy();
    expect(window.localStorage.getItem(storageKey)).toBe('done');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('retries a failed PDF preview without replacing the source', () => {
    const onRetryPreview = jest.fn();
    render(<DrawingStudio
      defaultValue={{
        schemaVersion: 1,
        background: {
          fileName: 'source.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1000,
          kind: 'pdf',
          storagePath: 'construction-plans/site-1/plan-1/drawings/source.pdf',
        },
        preview: {
          status: 'failed',
          errorCode: 'PDF_PASSWORD_REQUIRED',
          errorMessage: '암호화된 PDF입니다.',
        },
        objects: [],
      }}
      onRetryPreview={onRetryPreview}
    />);

    fireEvent.click(screen.getByRole('button', { name: '미리보기 다시 생성' }));
    expect(onRetryPreview).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/암호화된 PDF입니다/)).toBeTruthy();
  });

  it('reveals and selects the exact annotation requested by validation navigation', () => {
    render(<DrawingStudio
      defaultValue={{
        schemaVersion: 1,
        objects: [{
          id: 'risk-zone-7',
          kind: 'polygon',
          layer: 'restricted',
          points: [{ x: 0.65, y: 0.6 }, { x: 0.9, y: 0.6 }, { x: 0.8, y: 0.9 }],
          label: '양중 위험구간',
          zoneCode: 'R-07',
        }],
      }}
      focusObjectId="risk-zone-7"
      focusRequestKey={1}
    />);

    const objectButton = document.getElementById('construction-drawing-object-risk-zone-7');
    expect(objectButton?.getAttribute('aria-current')).toBe('true');
    const canvas = screen.getByRole('img', { name: '시공 도면 표시 캔버스' });
    expect(canvas.getAttribute('viewBox')).not.toBe('0 0 1000 700');
    expect((screen.getByLabelText('구역 코드') as HTMLInputElement).value).toBe('R-07');
  });

  it('lists objects accessibly and deletes one from the list', () => {
    const onChange = jest.fn();
    render(
      <DrawingStudio
        defaultValue={{
          schemaVersion: 1,
          objects: [{
            id: 'restricted-one',
            kind: 'polygon',
            layer: 'restricted',
            points: [{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.1 }, { x: 0.3, y: 0.5 }],
            label: '크레인 하부',
            zoneCode: 'R-01',
          }],
        }}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /출입 통제 구역 다각형, R-01 크레인 하부 삭제/ }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ objects: [] }));
    expect(screen.getByText('아직 등록된 표시가 없습니다.')).toBeTruthy();
  });
});
