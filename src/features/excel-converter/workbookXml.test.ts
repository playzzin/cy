import { xml } from './workbook';

test('선두 BOM이 있는 XML을 읽으며 셀 안의 문자는 보존한다', () => {
  const doc = xml('\uFEFF<?xml version="1.0" encoding="utf-8"?><root><value>가\uFEFF나</value></root>');
  expect(doc.documentElement.nodeName).toBe('root');
  expect(doc.getElementsByTagName('value')[0].textContent).toBe('가\uFEFF나');
});

test('BOM 처리 후에도 잘못된 XML과 외부 정의를 거부한다', () => {
  expect(() => xml('\uFEFF<root><value></root>')).toThrow('엑셀 내부 XML이 손상되었습니다.');
  expect(() => xml('\uFEFF<!DOCTYPE root [<!ENTITY value "outside">]><root>&value;</root>')).toThrow('외부 정의가 포함된 XML은 처리할 수 없습니다.');
  expect(() => xml('임의의문자<root/>')).toThrow('엑셀 내부 XML이 손상되었습니다.');
});
