import { getScrollCaptureContentY, getScrollCaptureViewport } from './scrollCaptureGeometry';

const element = (left: number, top: number, width: number, height: number, border = 0) => {
    const target = document.createElement('div');
    Object.defineProperties(target, {
        clientLeft: { value: border }, clientTop: { value: border },
        clientWidth: { value: width - border * 2 }, clientHeight: { value: height - border * 2 }
    });
    target.getBoundingClientRect = () => ({ left, top, right: left + width, bottom: top + height, width, height } as DOMRect);
    document.body.appendChild(target);
    return target;
};

describe('scroll capture visible content coordinates', () => {
    afterEach(() => { document.body.replaceChildren(); });

    it('removes client borders and keeps the clipped top content offset', () => {
        const target = element(100, -102, 304, 504, 2);
        target.scrollTop = 400;
        expect(getScrollCaptureViewport(target)).toEqual({ left: 102, top: 0, width: 300, height: 400, contentTop: 500 });
        expect(getScrollCaptureContentY(target, -20)).toBe(500);
        expect(getScrollCaptureContentY(target, 400)).toBe(900);
        expect(getScrollCaptureContentY(target, 600)).toBe(900);
    });

    it('intersects nested overflow clips with each ancestor client area', () => {
        const outer = element(110, 90, 250, 310, 5);
        outer.style.overflow = 'hidden';
        const inner = element(80, 70, 300, 500);
        inner.style.overflowY = 'auto';
        outer.appendChild(inner);
        const target = element(100, 30, 300, 600);
        target.scrollTop = 1000;
        inner.appendChild(target);
        expect(getScrollCaptureViewport(target)).toEqual({ left: 115, top: 95, width: 240, height: 300, contentTop: 1065 });
        expect(getScrollCaptureContentY(target, 395)).toBe(1365);
    });

    it('clips only the overflow axis and clamps points to the visible content', () => {
        const ancestor = element(200, 100, 100, 200);
        ancestor.style.overflowY = 'clip';
        const target = element(50, 50, 400, 500);
        ancestor.appendChild(target);
        expect(getScrollCaptureViewport(target)).toEqual({ left: 50, top: 100, width: 400, height: 200, contentTop: 50 });
        expect(getScrollCaptureContentY(target, 500)).toBe(250);
    });

    it('uses viewport coordinates for the document scroll root', () => {
        const target = document.documentElement;
        const previous = target.scrollTop;
        target.scrollTop = 321;
        expect(getScrollCaptureViewport(target)).toEqual({ left: 0, top: 0, width: window.innerWidth, height: window.innerHeight, contentTop: 321 });
        expect(getScrollCaptureContentY(target, window.innerHeight)).toBe(321 + window.innerHeight);
        target.scrollTop = previous;
    });
});
