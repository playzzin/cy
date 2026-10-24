import fs from 'fs';
import path from 'path';
import { webcrypto } from 'crypto';
import JSZip from 'jszip';
import { editWorkbookLayout, rebaseLayoutPlan, shiftLayoutFormula, shiftLayoutRange } from './layoutEditing';
import { elements, readWorkbook, xml } from './workbook';
import { planSchema } from './types';

Object.defineProperty(globalThis,'crypto',{value:webcrypto});
const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
async function fixture(){
  const zip=await JSZip.loadAsync(fs.readFileSync(path.join(process.cwd(),'public/excel-converter/examples/01_우리회사_원본.xlsx')));
  zip.file('xl/worksheets/sheet1.xml',`<worksheet xmlns="${ns}"><dimension ref="A1:E5"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="2" topLeftCell="A3" state="frozen"/></sheetView></sheetViews><sheetData>
    <row r="1"><c r="A1" t="inlineStr"><is><t>제목</t></is></c></row>
    <row r="2"><c r="A2"><v>10</v></c><c r="B2"><f t="shared" si="0" ref="B2:B3">A2*2</f><v>20</v></c><c r="D2"><f>$A$2+A3+SUM(A2:A4)+IF(A2=10,"A2",0)</f><v>0</v></c></row>
    <row r="3"><c r="A3"><v>20</v></c><c r="B3"><f t="shared" si="0"/><v>40</v></c></row>
    <row r="4"><c r="A4"><v>30</v></c></row>
    <row r="5"><c r="A5" t="inlineStr"><is><t>합계</t></is></c></row>
    </sheetData><mergeCells count="1"><mergeCell ref="A1:C1"/></mergeCells><conditionalFormatting sqref="A2:A4"><cfRule type="expression" priority="1"><formula>A2&gt;0</formula></cfRule></conditionalFormatting><dataValidations count="1"><dataValidation type="whole" sqref="A2:A4"><formula1>0</formula1><formula2>$A$4</formula2></dataValidation></dataValidations></worksheet>`);
  return readWorkbook(await zip.generateAsync({type:'arraybuffer'}),'가상구조.xlsx');
}
const cell=(file:Awaited<ReturnType<typeof fixture>>,address:string)=>file.sheets[0].cells.find(c=>c.address===address);
test('행 삽입은 병합·공유 수식·절대 참조·검증 범위를 함께 이동하고 원본은 보존한다',async()=>{
  const original=await fixture(),bytes=original.bytes.slice(0);
  const changed=await editWorkbookLayout(original,original.sheets[0].name,[{kind:'insertRows',at:2,count:2}]);
  expect(cell(changed,'A4')?.value).toBe(10);
  expect(cell(changed,'B4')?.formula).toBe('A4*2');
  expect(cell(changed,'B5')?.formula).toBe('A5*2');
  expect(cell(changed,'D4')?.formula).toBe('$A$4+A5+SUM(A4:A6)+IF(A4=10,"A2",0)');
  expect(changed.sheets[0].merges).toContain('A1:C1');
  const zip=await JSZip.loadAsync(changed.bytes),doc=xml(await zip.file(changed.sheets[0].path)!.async('string'));
  expect(elements(doc,'dataValidation')[0].getAttribute('sqref')).toBe('A4:A6');
  expect(elements(doc,'formula2')[0].textContent).toBe('$A$6');
  expect(elements(doc,'formula')[0].textContent).toBe('A4>0');
  expect(elements(doc,'pane')[0].getAttribute('ySplit')).toBe('4');
  expect(original.bytes).toEqual(bytes);expect(cell(original,'A2')?.value).toBe(10);
});
test('열 추가와 행 삭제는 좌표를 순서대로 옮기고 삭제한 셀 참조를 표시한다',async()=>{
  const original=await fixture();
  const changed=await editWorkbookLayout(original,original.sheets[0].name,[{kind:'insertColumns',at:1,count:1},{kind:'deleteRows',at:2,count:1}]);
  expect(cell(changed,'B2')?.value).toBe(20);expect(cell(changed,'C2')?.formula).toBe('B2*2');
  expect(changed.sheets[0].merges).toContain('B1:D1');
  expect(shiftLayoutFormula('$A$2+SUM(A2:A4)',{kind:'deleteRows',at:2,count:1},'S','S')).toBe('#REF!+SUM(A2:A3)');
});
test('수식은 다른 시트·문자열·함수 이름을 바꾸지 않고 해당 시트 참조만 이동한다',()=>{
  const edit={kind:'insertRows' as const,at:2,count:2};
  expect(shiftLayoutFormula(`'입력 양식'!$A$2+Other!A2+A2+LOG10(A2)+"A2"`,edit,'입력 양식','Other')).toBe(`'입력 양식'!$A$4+Other!A2+A2+LOG10(A2)+"A2"`);
  expect(shiftLayoutRange('$2:$4',edit)).toBe('$4:$6');
  expect(shiftLayoutFormula('SUM(Table1[A2])+A2',edit,'S','S')).toBe('SUM(Table1[A2])+A4');
  expect(shiftLayoutRange('A2:A5',{kind:'deleteRows',at:3,count:2})).toBe('A2:A3');
});
test('범위 복사는 상대 수식과 병합을 복사하고 이동은 참조를 따라가게 한다',async()=>{
  const original=await fixture(),name=original.sheets[0].name;
  const copied=await editWorkbookLayout(original,name,[{kind:'copyRange',range:'A2:B3',to:'F6'},{kind:'copyRange',range:'A1:C1',to:'F1'}]);
  expect(cell(copied,'F6')?.value).toBe(10);expect(cell(copied,'G7')?.formula).toBe('F7*2');
  expect(copied.sheets[0].merges).toEqual(expect.arrayContaining(['A1:C1','F1:H1']));
  const moved=await editWorkbookLayout(original,name,[{kind:'moveRange',range:'A2:B3',to:'F6'}]);
  expect(cell(moved,'A2')).toBeUndefined();expect(cell(moved,'G6')?.formula).toBe('F6*2');
  expect(cell(moved,'D2')?.formula).toBe('$F$6+F7+SUM(A2:A4)+IF(F6=10,"A2",0)');
});
test('범위 비우기는 서식을 남기고 값·수식을 지우며 실패는 원본을 바꾸지 않는다',async()=>{
  const original=await fixture(),bytes=original.bytes.slice(0),name=original.sheets[0].name;
  const cleared=await editWorkbookLayout(original,name,[{kind:'clearRange',range:'A2:B3'}]);
  expect(cell(cleared,'A2')?.value).toBeNull();expect(cell(cleared,'B2')?.formula).toBeUndefined();
  await expect(editWorkbookLayout(original,name,[{kind:'moveRange',range:'B1:C1',to:'E1'}])).rejects.toThrow('병합 셀 전체');
  await expect(editWorkbookLayout(original,name,[{kind:'insertColumns',at:1,count:100}])).rejects.toThrow();
  expect(original.bytes).toEqual(bytes);
});
test('제목과 개인별 수정·서식은 새 양식 좌표로 이전한다',()=>{
  const previous=planSchema.parse({version:1,targetId:'target',sheetName:'S',headerRow:1,startRow:2,endRow:10,rules:{sort:[{key:'name',direction:'desc'}]},mappings:[{label:'성명',targetColumn:1,sourceKeys:['name'],mode:'copy'}],fixedCells:[{address:'B1',mapping:{label:'제목',targetColumn:2,sourceKeys:[],mode:'constant',constant:'바꾼 제목'}}],overrides:[{originsKey:'person1',targetColumn:1,value:'수정값',kind:'text'}],edits:[{kind:'style',range:'A2',style:{bold:true}}]});
  const next=planSchema.parse({...previous,mappings:[{...previous.mappings[0],targetColumn:2}],fixedCells:[],overrides:[],edits:[]});
  const changed=rebaseLayoutPlan(previous,next,[{kind:'insertColumns',at:1,count:1}]);
  expect(changed.fixedCells[0]).toMatchObject({address:'C1',mapping:{constant:'바꾼 제목'}});
  expect(changed.overrides[0].targetColumn).toBe(2);expect(changed.edits[0]).toMatchObject({range:'B2'});expect(changed.rules).toEqual(previous.rules);
  const moved=rebaseLayoutPlan({...previous,edits:[{kind:'style',range:'A2',style:{bold:true},anchor:{recordKey:'person1',mappingKey:'column:1:0',address:'A2'}}]},next,[{kind:'moveRange',range:'A2:A10',to:'B2'}]);
  expect(moved.edits[0]).toMatchObject({range:'B2',anchor:{mappingKey:'column:2:0',address:'B2'}});
});
