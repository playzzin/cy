import { fireEvent, render, screen } from '@testing-library/react';
import IconPicker from './IconPicker';

it('관리자가 열면 전체 아이콘 목록에서 검색한 아이콘을 선택할 수 있다', async () => {
    const onSelect = jest.fn();
    const onClose = jest.fn();
    const view = render(<IconPicker isOpen={false} onSelect={onSelect} onClose={onClose} />);
    expect(screen.queryByRole('textbox')).toBeNull();
    view.rerender(<IconPicker isOpen onSelect={onSelect} onClose={onClose} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'horsehead' } });
    fireEvent.click(await screen.findByTitle('faHorseHead'));
    expect(onSelect).toHaveBeenCalledWith('faHorseHead');
    expect(onClose).toHaveBeenCalledTimes(1);
});
