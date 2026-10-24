import React, { useId, useRef, useState } from 'react';
import './ExpenseTeamSelect.css';

type Team = { id: string; name: string };
const searchKey = (value: string) => value.replace(/\s+/g, '').toLocaleLowerCase('ko-KR');

export default function ExpenseTeamSelect({ teams, value, onChange }: { teams: Team[]; value: string; onChange: (id: string) => void }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const selected = teams.find(team => team.id === value);
  const matches = teams.filter(team => searchKey(team.name).includes(searchKey(query)));
  const activeIndex = Math.min(active, matches.length - 1);
  const choose = (team: Team) => {
    if (input.current?.matches(':disabled')) return;
    onChange(team.id); setOpen(false); setQuery('');
  };
  return <div className="expense-team-select">
    <label htmlFor={id}>청구팀</label>
    <input id={id} ref={input} role="combobox" autoComplete="off" required
      aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-list`}
      aria-activedescendant={open && activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined}
      placeholder="팀 이름을 검색해서 선택" value={open ? query : selected?.name || ''}
      onFocus={() => { setOpen(true); setQuery(''); setActive(0); }}
      onClick={() => { if (!open) { setOpen(true); setQuery(''); setActive(0); } }}
      onChange={event => { setQuery(event.target.value); setActive(0); setOpen(true); }}
      onBlur={() => { setOpen(false); setQuery(''); }}
      onKeyDown={event => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === 'Escape') { event.preventDefault(); setOpen(false); setQuery(''); }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          if (!open) { setOpen(true); setQuery(''); setActive(0); }
          else setActive(index => Math.max(0, Math.min(matches.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))));
        }
        if (event.key === 'Enter' && open) { event.preventDefault(); if (matches[activeIndex]) choose(matches[activeIndex]); }
      }} />
    {open && <ul id={`${id}-list`} role="listbox" aria-label="청구팀 검색 결과">
      {matches.map((team, index) => <li id={`${id}-option-${index}`} key={team.id} role="option"
        aria-selected={team.id === value} className={index === activeIndex ? 'active' : undefined}
        onMouseDown={event => event.preventDefault()} onClick={() => choose(team)}>{team.name}</li>)}
      {!matches.length && <li role="presentation"><span role="status">검색 결과가 없습니다.</span></li>}
    </ul>}
  </div>;
}
