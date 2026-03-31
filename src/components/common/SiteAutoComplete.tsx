import React, { useEffect, useMemo, useState } from 'react';
import { siteService, Site } from '../../services/siteService';

interface SiteAutoCompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const SiteAutoComplete: React.FC<SiteAutoCompleteProps> = ({ value, onChange, placeholder }) => {
  const [siteList, setSiteList] = useState<Site[]>([]);
  const [inputValue, setInputValue] = useState(value || '');
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    siteService.getSites().then(setSiteList);
  }, []);

  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  const filteredSites = useMemo(() => {
    const keyword = inputValue.trim().toLowerCase();
    if (!keyword) return siteList;
    return siteList.filter(site => site.name?.toLowerCase().includes(keyword));
  }, [siteList, inputValue]);

  const handleSelect = (siteName: string) => {
    onChange(siteName);
    setInputValue(siteName);
    setShowDropdown(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <input
        type="text"
        value={inputValue}
        onChange={e => {
          setInputValue(e.target.value);
          setShowDropdown(true);
          onChange(''); // 선택 전까지 값 비움
        }}
        onFocus={() => setShowDropdown(true)}
        onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
        placeholder={placeholder || '현장명을 입력/검색하세요'}
        className="border border-slate-300 rounded px-2 py-1 w-full"
        autoComplete="off"
        style={{ background: 'white', zIndex: 20, position: 'relative', outline: '3px solid red', height: '40px', minWidth: '200px' }}
      />
      {showDropdown && filteredSites.length > 0 && (
        <ul className="absolute z-10 bg-white border border-slate-200 rounded w-full max-h-48 overflow-auto shadow-lg mt-1">
          {filteredSites.map(site => (
            <li
              key={site.id}
              className="px-3 py-2 hover:bg-blue-100 cursor-pointer text-sm"
              onMouseDown={() => handleSelect(site.name)}
            >
              {site.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default SiteAutoComplete;
