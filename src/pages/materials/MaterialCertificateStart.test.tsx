import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MaterialCertificateStart from './MaterialCertificateStart';

it.each(['inbound', 'outbound'] as const)('%s 메뉴에서 확인서 준비 화면을 거쳐 등록으로 이동한다', kind => {
  const label = kind === 'inbound' ? '입고' : '출고';
  render(<MemoryRouter><Routes><Route path="/" element={<MaterialCertificateStart kind={kind} />} /><Route path={`/materials/${kind}`} element={<p>자재 등록 화면</p>} /></Routes></MemoryRouter>);
  expect(screen.getByRole('heading', { name: `${label} 확인서 만들기` })).toBeInTheDocument();
  expect(screen.queryByText(/데이터를 찾을 수 없습니다/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: `${label} 내역 준비하기` }));
  expect(screen.getByText('자재 등록 화면')).toBeInTheDocument();
});
