import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';
import fs from 'fs';import path from 'path';
import { webcrypto } from 'crypto';
import WorkbookPreview, { DocumentSheet } from './WorkbookPreview';
import { readWorkbook } from './workbook';
import type { SheetInfo } from './types';
Object.defineProperty(globalThis,'crypto',{value:webcrypto});
const read = async(name:string)=>{const b=fs.readFileSync(path.join(process.cwd(),'public/excel-converter/examples',name));const bytes=new ArrayBuffer(b.length);new Uint8Array(bytes).set(b);return readWorkbook(bytes,name);};
test('실제 양식의 병합·너비·색을 읽고 원본과 받을 양식을 전환한다',async()=>{
 const source=await read('10_현재위임장_가상원본.xlsx'),target=await read('11_타회사위임장_개인별양식.xlsx');
 expect(target.sheets[0].presentation?.styles.some(s=>s.background)).toBe(true);
 render(<WorkbookPreview source={source} target={target}/>);
 expect(screen.getByRole('tab',{name:'받을 양식'})).toHaveAttribute('aria-selected','true');
 expect(screen.getAllByRole('cell').find(cell=>cell.getAttribute('data-address')==='C3')).toHaveAttribute('colspan','4');
 fireEvent.click(screen.getByRole('tab',{name:'원본'}));expect(screen.getByRole('table')).toHaveAccessibleName('위임장 문서 내용');
});
test('개인별 완성 파일 전환과 가려진 행·열을 처리한다',async()=>{
 const target=await read('11_타회사위임장_개인별양식.xlsx');
 const out=(name:string,worker:string)=>({name,bytes:target.bytes,sheets:[{...target.sheets[0],cells:target.sheets[0].cells.map(c=>c.address==='C6'?{...c,value:worker,text:worker}:c)}],traces:[],issues:[],inputCount:1,excludedCount:0,outputCount:1,group:''});
 render(<WorkbookPreview target={target} outputs={[out('첫번째.xlsx','가상 첫째'),out('두번째.xlsx','가상 둘째')]}/>);
 expect(screen.getByText('가상 첫째')).toBeInTheDocument();fireEvent.change(screen.getByLabelText('미리보기 문서 선택'),{target:{value:'1'}});expect(screen.getByText('가상 둘째')).toBeInTheDocument();
});
test('60행 경계를 넘는 병합 칸도 다음 페이지에서 원래 값을 보여 준다',()=>{
 const sheet:SheetInfo={name:'경계',path:'',rowCount:62,columnCount:2,headerRow:1,hiddenRows:[],hiddenColumns:[2],warnings:[],merges:['A60:A62'],cells:[{address:'A60',row:60,col:1,value:'병합된 내용',kind:'text',text:'병합된 내용',style:0}]};
 render(<DocumentSheet sheet={sheet}/>);fireEvent.click(screen.getByRole('button',{name:'다음 60행'}));
 expect(screen.getByText('병합된 내용')).toBeInTheDocument();expect(screen.getByRole('cell',{name:'병합된 내용'})).toHaveAttribute('rowspan','2');expect(screen.getAllByRole('cell')).toHaveLength(1);
});

test('너비 맞춤은 숨긴 열을 제외하고 화면 크기에 맞추며 수동 확대도 유지한다',async()=>{
 const target=await read('11_타회사위임장_개인별양식.xlsx');
 let resize:()=>void=()=>{};
 const previous=globalThis.ResizeObserver;
 const disconnect=jest.fn();
 globalThis.ResizeObserver=class {constructor(callback:()=>void){resize=callback;}observe(){}unobserve(){}disconnect=disconnect;} as unknown as typeof ResizeObserver;
 try {
  const sheet={...target.sheets[0],columnCount:3,hiddenColumns:[2],presentation:{...target.sheets[0].presentation!,widths:{1:500,2:900,3:500}}};
  const {container,unmount}=render(<WorkbookPreview target={{...target,sheets:[sheet]}}/>);
  // Layout measurements need the scroll surface and its scaled child; neither is an interactive control.
  // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
  const viewport=container.querySelector('.wp-paper-scroll')!;
  // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
  const zoom=container.querySelector('.wp-zoom')! as HTMLElement;
  Object.defineProperty(viewport,'clientWidth',{configurable:true,value:521});
  act(()=>resize());
  fireEvent.change(screen.getByLabelText('미리보기 배율'),{target:{value:'fit'}});
  expect(Number((zoom.style as CSSStyleDeclaration & {zoom:string}).zoom)).toBeCloseTo(.5);
  Object.defineProperty(viewport,'clientWidth',{configurable:true,value:1042});
  act(()=>resize());
  expect(Number((zoom.style as CSSStyleDeclaration & {zoom:string}).zoom)).toBe(1);
  fireEvent.change(screen.getByLabelText('미리보기 배율'),{target:{value:'200'}});
  act(()=>resize());
  expect(Number((zoom.style as CSSStyleDeclaration & {zoom:string}).zoom)).toBe(2);
  unmount();expect(disconnect).toHaveBeenCalled();
 } finally {globalThis.ResizeObserver=previous;}
});
