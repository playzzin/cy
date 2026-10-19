import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import BusinessConstructionFilm from './BusinessConstructionFilm';

const fallback = <svg role="img" aria-label="기존 프레임 구조도" />;
const props = { paused: false, reducedMotion: false, fallback };
let play: jest.SpyInstance;
let pause: jest.SpyInstance;

beforeEach(() => {
    play = jest.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    pause = jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

it('영상이 준비된 후 재생하고 외부 일시정지와 재생을 따른다', () => {
    const view = render(<BusinessConstructionFilm {...props} />);
    const video = screen.getByTestId('construction-film-video');
    expect(screen.getByRole('img', { name: '기존 프레임 구조도' })).toBeInTheDocument();
    expect(play).not.toHaveBeenCalled();
    fireEvent.loadedData(video);
    expect(play).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('img', { name: /프레임 조립 모션 그래픽/ })).toBeInTheDocument();
    view.rerender(<BusinessConstructionFilm {...props} paused />);
    expect(pause).toHaveBeenCalled();
    view.rerender(<BusinessConstructionFilm {...props} />);
    expect(play).toHaveBeenCalledTimes(2);
});

it('영상 오류 시 구조도로 복구하고 모션 감소 시 영상 요청을 만들지 않는다', () => {
    const view = render(<BusinessConstructionFilm {...props} />);
    fireEvent.error(screen.getByTestId('construction-film-video'));
    expect(screen.queryByTestId('construction-film-video')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: '기존 프레임 구조도' })).toBeInTheDocument();
    view.unmount();
    render(<BusinessConstructionFilm {...props} reducedMotion />);
    expect(screen.queryByTestId('construction-film-video')).not.toBeInTheDocument();
    expect(play).not.toHaveBeenCalled();
});

it('브라우저가 자동 재생을 차단하면 구조도로 복구한다', async () => {
    play.mockRejectedValue(new DOMException('Blocked', 'NotAllowedError'));
    render(<BusinessConstructionFilm {...props} />);
    fireEvent.loadedData(screen.getByTestId('construction-film-video'));
    await waitFor(() => expect(screen.queryByTestId('construction-film-video')).not.toBeInTheDocument());
    expect(screen.getByRole('img', { name: '기존 프레임 구조도' })).toBeInTheDocument();
});

it('모션 감소 설정을 해제하면 새 영상의 준비를 기다린다', () => {
    const view = render(<BusinessConstructionFilm {...props} />);
    fireEvent.loadedData(screen.getByTestId('construction-film-video'));
    view.rerender(<BusinessConstructionFilm {...props} reducedMotion />);
    expect(screen.queryByTestId('construction-film-video')).not.toBeInTheDocument();
    view.rerender(<BusinessConstructionFilm {...props} />);
    expect(screen.getByRole('img', { name: '기존 프레임 구조도' })).toBeInTheDocument();
    expect(play).toHaveBeenCalledTimes(1);
});
